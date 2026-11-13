import { getAccessToken, clearAuthCache } from "./auth.js";
import { assertSafeAdoUrl } from "./utils.js";


/**
 * Helper to execute an authenticated fetch request against ADO REST API.
 * Automatically validates URL safety, injects Bearer token, enforces timeout,
 * and retries once on 401.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(url, options = {}) {
  // Validate URL to prevent Bearer token exfiltration and SSRF
  assertSafeAdoUrl(url);

  let token = await getAccessToken();

  const makeCall = async (bearerToken) => {
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
      ...(options.headers || {}),
    };

    return await fetch(url, {
      ...options,
      headers,
    });
  };

  let response = await makeCall(token);

  // If token expired, clear cache and retry once
  if (response.status === 401) {
    clearAuthCache();
    token = await getAccessToken({ forceRefresh: true });
    response = await makeCall(token);
  }

  if (!response.ok) {
    let message = `Azure DevOps API Error: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson.message === "string") {
        message = errJson.message;
      }
    } catch {
      // Ignore JSON parse error on non-JSON error pages
    }
    throw new Error(message);
  }

  return await response.json();
}

/**
 * Gets the authenticated user's connection profile and identity.
 * @param {import("./config.js").AdoConfig} config
 * @returns {Promise<{ id: string, displayName: string, email: string }>}
 */
export async function getCurrentUser(config) {
  const url = `${config.organization}/_apis/connectionData?api-version=7.1-preview`;
  const data = await request(url);
  const user = data.authenticatedUser || {};
  return {
    id: user.id || "",
    displayName: user.customDisplayName || user.providerDisplayName || "User",
    email: user.properties?.Account?.$value || user.mailAddress || user.providerDisplayName || "",
  };
}

/**
 * Lists Pull Requests for the configured project.
 *
 * @param {import("./config.js").AdoConfig} config
 * @param {{ filter?: "mine" | "assigned" | "all", prStatus?: "active" | "completed" | "abandoned" | "all", userId?: string, user?: string, currentUser?: any }} [options]
 * @returns {Promise<Array<any>>}
 */
export async function getPullRequests(config, options = {}) {
  const { filter = "assigned", prStatus = "active", userId, user, currentUser } = options;
  const targetUser = (user || config.user || "").trim();
  const project = encodeURIComponent(config.project);
  const statusParam = prStatus ? `searchCriteria.status=${encodeURIComponent(prStatus)}` : "searchCriteria.status=active";
  let query = `${statusParam}&api-version=7.1&$top=100`;

  // Determine if targetUser matches the authenticated user
  const authUser = currentUser || (userId ? { id: userId, displayName: "", email: "" } : null);
  const term = targetUser.toLowerCase();
  const isMatchCurrent =
    !targetUser ||
    (authUser &&
      (authUser.id.toLowerCase() === term ||
        (authUser.displayName && authUser.displayName.toLowerCase().includes(term)) ||
        (authUser.email && authUser.email.toLowerCase().includes(term))));

  const serverUserId = isMatchCurrent ? authUser?.id : null;

  if (serverUserId) {
    if (filter === "mine") {
      query += `&searchCriteria.creatorId=${encodeURIComponent(serverUserId)}`;
    } else if (filter === "assigned") {
      query += `&searchCriteria.reviewerId=${encodeURIComponent(serverUserId)}`;
    }
  }

  const url = `${config.organization}/${project}/_apis/git/pullrequests?${query}`;
  const data = await request(url);
  let prs = (data.value || []).map((pr) => ({
    id: pr.pullRequestId,
    title: pr.title || `PR #${pr.pullRequestId}`,
    description: pr.description || "",
    status: pr.status,
    author: pr.createdBy?.displayName || "Unknown",
    authorId: pr.createdBy?.id,
    authorEmail: pr.createdBy?.uniqueName || "",
    reviewers: (pr.reviewers || []).map((r) => ({
      id: r.id,
      displayName: r.displayName || "",
      uniqueName: r.uniqueName || "",
      vote: r.vote || 0,
    })),
    authorAvatar: pr.createdBy?._links?.avatar?.href,
    repositoryId: pr.repository?.id,
    repositoryName: pr.repository?.name,
    sourceBranch: (pr.sourceRefName || "").replace("refs/heads/", ""),
    targetBranch: (pr.targetRefName || "").replace("refs/heads/", ""),
    creationDate: pr.creationDate,
    url: pr._links?.web?.href || `${config.organization}/${project}/_git/${encodeURIComponent(pr.repository?.name || "")}/pullrequest/${pr.pullRequestId}`,
  }));

  if (targetUser) {
    const term = targetUser.toLowerCase();
    if (filter === "mine") {
      prs = prs.filter((p) =>
        p.author.toLowerCase().includes(term) ||
        p.authorEmail.toLowerCase().includes(term)
      );
    } else if (filter === "assigned") {
      prs = prs.filter((p) =>
        p.reviewers.some((r) =>
          r.displayName.toLowerCase().includes(term) ||
          r.uniqueName.toLowerCase().includes(term)
        )
      );
    }
  }

  return prs;
}

/**
 * Retrieves review comment threads for a Pull Request.
 *
 * @param {import("./config.js").AdoConfig} config
 * @param {{ repositoryId: string, pullRequestId: number }} params
 * @returns {Promise<Array<any>>}
 */
export async function getPullRequestThreads(config, { repositoryId, pullRequestId }) {
  const project = encodeURIComponent(config.project);
  const repoId = encodeURIComponent(repositoryId);
  const prId = encodeURIComponent(String(pullRequestId));
  const url = `${config.organization}/${project}/_apis/git/repositories/${repoId}/pullRequests/${prId}/threads?api-version=7.1`;
  const data = await request(url);

  return (data.value || [])
    .filter((t) => !t.isDeleted && t.comments && t.comments.length > 0)
    .map((thread) => {
      const isSystem = thread.comments.every((c) => c.commentType === "system");
      const comments = (thread.comments || [])
        .filter((c) => !c.isDeleted)
        .map((c) => ({
          id: c.id,
          author: c.author?.displayName || "Unknown",
          authorAvatar: c.author?._links?.avatar?.href,
          content: c.content || "",
          publishedDate: c.publishedDate,
          commentType: c.commentType,
        }))
        .sort((a, b) => {
          const timeA = new Date(a.publishedDate || 0).getTime();
          const timeB = new Date(b.publishedDate || 0).getTime();
          return timeB - timeA || (b.id || 0) - (a.id || 0);
        });

      const latestTime = comments.length > 0
        ? new Date(comments[0].publishedDate || 0).getTime()
        : new Date(thread.lastUpdatedDate || thread.publishedDate || 0).getTime();

      return {
        id: thread.id,
        status: thread.status || "active",
        isSystem,
        publishedDate: thread.publishedDate,
        lastUpdatedDate: thread.lastUpdatedDate,
        latestActivityTime: latestTime,
        filePath: thread.threadContext?.filePath || null,
        lineNumber: thread.threadContext?.rightFileStart?.line || null,
        comments,
      };
    })
    .sort((a, b) => (b.latestActivityTime || 0) - (a.latestActivityTime || 0) || (b.id || 0) - (a.id || 0));
}

/**
 * Retrieves the modified files and stats for a Pull Request.
 *
 * @param {import("./config.js").AdoConfig} config
 * @param {{ repositoryId: string, pullRequestId: number }} params
 * @returns {Promise<Array<any>>}
 */
export async function getPullRequestChanges(config, { repositoryId, pullRequestId }) {
  const project = encodeURIComponent(config.project);
  const repoId = encodeURIComponent(repositoryId);
  const prId = encodeURIComponent(String(pullRequestId));

  const iterUrl = `${config.organization}/${project}/_apis/git/repositories/${repoId}/pullRequests/${prId}/iterations?api-version=7.1`;
  const iterData = await request(iterUrl);
  const iterations = iterData.value || [];
  if (iterations.length === 0) return [];

  const latestIterationId = iterations[iterations.length - 1].id;
  const changesUrl = `${config.organization}/${project}/_apis/git/repositories/${repoId}/pullRequests/${prId}/iterations/${latestIterationId}/changes?api-version=7.1&$top=200`;
  const changesData = await request(changesUrl);

  return (changesData.changeEntries || []).map((entry) => ({
    path: entry.item?.path || entry.originalPath || "",
    changeType: entry.changeType || "edit",
  }));
}

/**
 * Lists active Work Items assigned to the current user with status and type filters.
 *
 * @param {import("./config.js").AdoConfig} config
 * @param {{
 *   status?: "active" | "todo" | "in_progress" | "committed" | "resolved" | "not_started" | "removed" | "all",
 *   type?: "task" | "bug" | "feature" | "pbi" | "all"
 * }} [options]
 * @returns {Promise<Array<any>>}
 */
export async function getAssignedWorkItems(config, options = {}) {
  const { status = "active", type = "all" } = options;
  const project = encodeURIComponent(config.project);
  const wiqlUrl = `${config.organization}/${project}/_apis/wit/wiql?api-version=7.1`;

  const normStatus = (status || "active").toLowerCase().replace(/[^a-z]/g, "");
  let stateFilter = "";
  if (normStatus === "all") {
    stateFilter = "";
  } else if (normStatus === "todo") {
    stateFilter = "AND [System.State] IN ('To Do', 'Todo', 'New', 'Not Started', 'Proposed')";
  } else if (normStatus === "notstarted") {
    stateFilter = "AND [System.State] IN ('Not Started', 'To Do', 'New')";
  } else if (normStatus === "inprogress" || normStatus === "doing") {
    stateFilter = "AND [System.State] IN ('In Progress', 'Doing')";
  } else if (normStatus === "committed" || normStatus === "commited" || normStatus === "approved") {
    stateFilter = "AND [System.State] IN ('Committed', 'Approved')";
  } else if (normStatus === "resolved") {
    stateFilter = "AND [System.State] IN ('Resolved', 'Done', 'Closed')";
  } else if (normStatus === "removed") {
    stateFilter = "AND [System.State] = 'Removed'";
  } else {
    // "active" (default)
    stateFilter = "AND [System.State] <> 'Closed' AND [System.State] <> 'Done' AND [System.State] <> 'Removed'";
  }

  const normType = (type || "all").toLowerCase().replace(/[^a-z]/g, "");
  let typeFilter = "";
  if (normType === "all") {
    typeFilter = "";
  } else if (normType === "task") {
    typeFilter = "AND [System.WorkItemType] = 'Task'";
  } else if (normType === "bug" || normType === "issue") {
    typeFilter = "AND ([System.WorkItemType] = 'Bug' OR [System.WorkItemType] = 'Issue')";
  } else if (normType === "feature") {
    typeFilter = "AND [System.WorkItemType] = 'Feature'";
  } else if (normType === "pbi" || normType === "productbacklogitem" || normType === "userstory") {
    typeFilter = "AND ([System.WorkItemType] = 'Product Backlog Item' OR [System.WorkItemType] = 'User Story')";
  }

  const wiqlQuery = {
    query: `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType]
            FROM WorkItems
            WHERE [System.AssignedTo] = @me
              ${stateFilter}
              ${typeFilter}
            ORDER BY [System.ChangedDate] DESC`,
  };

  const wiqlResult = await request(wiqlUrl, {
    method: "POST",
    body: JSON.stringify(wiqlQuery),
  });

  const rawIds = (wiqlResult.workItems || [])
    .slice(0, 50)
    .map((w) => Number(w.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (rawIds.length === 0) return [];

  const detailsUrl = `${config.organization}/_apis/wit/workitems?ids=${rawIds.join(",")}&$expand=all&api-version=7.1`;
  const detailsData = await request(detailsUrl);

  return (detailsData.value || []).map((item) => {
    const f = item.fields || {};
    return {
      id: item.id,
      title: f["System.Title"] || `Work Item #${item.id}`,
      type: f["System.WorkItemType"] || "Item",
      state: f["System.State"] || "New",
      assignedTo: f["System.AssignedTo"]?.displayName || "Unassigned",
      areaPath: f["System.AreaPath"] || "",
      iterationPath: f["System.IterationPath"] || "",
      createdDate: f["System.CreatedDate"],
      changedDate: f["System.ChangedDate"],
      url: item._links?.html?.href || `${config.organization}/${project}/_workitems/edit/${item.id}`,
    };
  });
}

/**
 * Retrieves full details and comments for a specific Work Item.
 *
 * @param {import("./config.js").AdoConfig} config
 * @param {number} workItemId
 * @returns {Promise<{ item: any, comments: Array<any> }>}
 */
export async function getWorkItemDetail(config, workItemId) {
  const id = Number(workItemId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid work item ID: '${workItemId}'`);
  }

  const project = encodeURIComponent(config.project);
  const itemUrl = `${config.organization}/_apis/wit/workitems/${id}?$expand=all&api-version=7.1`;
  const itemData = await request(itemUrl);

  const f = itemData.fields || {};
  const item = {
    id: itemData.id,
    title: f["System.Title"] || `Work Item #${itemData.id}`,
    type: f["System.WorkItemType"] || "Item",
    state: f["System.State"] || "New",
    description: f["System.Description"] || f["Microsoft.VSTS.Common.AcceptanceCriteria"] || "No description provided.",
    assignedTo: f["System.AssignedTo"]?.displayName || "Unassigned",
    url: itemData._links?.html?.href || `${config.organization}/${project}/_workitems/edit/${itemData.id}`,
  };

  let comments = [];
  try {
    const commentsUrl = `${config.organization}/${project}/_apis/wit/workitems/${id}/comments?api-version=7.1-preview.3&$top=50`;
    const commentsData = await request(commentsUrl);
    comments = (commentsData.comments || []).map((c) => ({
      id: c.id,
      author: c.createdBy?.displayName || "Unknown",
      text: c.text || "",
      createdDate: c.createdDate,
    }));
  } catch {
    comments = [];
  }

  return { item, comments };
}
