const simpleGit = require('simple-git');
const git = simpleGit();

// Add operation
async function addFiles(files) {
    try {
        await git.add(files);
        return { success: true, message: 'Files added successfully.' };
    }
    catch (error) {
        throw new Error(`Add failed: ${error.message}`);
    }
}

// Commit Operations
async function commitChanges(message, files) {
    try {
        await git.add(files);
        await git.commit(message);
        return { success: true, message: 'Commit created successfully.' };
    } catch (error) {
        throw new Error(`Commit failed: ${error.message}`);
    }
}

async function getCommitLogs(params) {
    const { commitHash, author, since, until } = params;
    try {
        const options = {};
        if (commitHash) options['--grep'] = commitHash;
        if (author) options['--author'] = author;
        if (since) options['--since'] = since;
        if (until) options['--until'] = until;

        const logs = await git.log(options);
        return logs.all;
    } catch (error) {
        throw new Error(`Error retrieving commit logs: ${error.message}`);
    }
}

async function revertToCommit(commitHash) {
    try {
        await git.reset(['--hard', commitHash]);
        return { success: true, message: `Reverted to commit ${commitHash} successfully.` };
    } catch (error) {
        throw new Error(`Revert failed: ${error.message}`);
    }
}

async function getDiffs(from, to, file) {
    try {
        let diffOutput;
        console.log([from, to, file]);
        if ((from || to) && file) {
            console.log('1');
            diffOutput = await git.diff([`${from}..${to}`, '--', file]);
        } else if (file) {
            console.log('2');
            diffOutput = await git.diff([file]);
        } else if ((from || to)) {
            console.log('3');
            diffOutput = await git.diff([`${from}..${to}`]);
        } else {
            console.log('4');
            diffOutput = await git.diff();
        }
        return diffOutput;
    } catch (error) {
        throw new Error(`Error retrieving diffs: ${error.message}`);
    }
}

// Branch Operations
async function listBranches() {
    try {
        const summary = await git.branchLocal();
        return summary.all;
    } catch (error) {
        throw new Error(`Failed to list branches: ${error.message}`);
    }
}

async function createBranch(name, startPoint = 'HEAD') {
    try {
        await git.checkoutBranch(name, startPoint);
        return { success: true, message: `Branch '${name}' created from '${startPoint}'.` };
    } catch (error) {
        throw new Error(`Create branch failed: ${error.message}`);
    }
}

async function deleteBranch(branchName) {
    try {
        await git.deleteLocalBranch(branchName, true);
        return { success: true, message: `Branch '${branchName}' deleted successfully.` };
    } catch (error) {
        throw new Error(`Delete branch failed: ${error.message}`);
    }
}

// Tag Operations
async function listTags() {
    try {
        const tags = await git.tags();
        return tags.all;
    } catch (error) {
        throw new Error(`Failed to list tags: ${error.message}`);
    }
}

async function createTag(name, commit) {
    try {
        await git.addTag(name, commit);
        return { success: true, message: `Tag '${name}' created at commit '${commit}'.` };
    } catch (error) {
        throw new Error(`Create tag failed: ${error.message}`);
    }
}

async function deleteTag(tagName) {
    try {
        await git.tag(['-d', tagName]);
        return { success: true, message: `Tag '${tagName}' deleted successfully.` };
    } catch (error) {
        throw new Error(`Delete tag failed: ${error.message}`);
    }
}

async function getStatus() {
    try {
        const statusSummary = await git.status();
        return statusSummary;
    } catch (error) {
        throw new Error(`Failed to get status: ${error.message}`);
    }
}

// Stash Operations
async function getStashList() {
    return await git.stashList();
}

async function createStash(message = 'Saved changes') {
    return await git.stash(['save', message]);
}

async function applyStash(stashId) {
    return await git.stash(['apply', stashId]);
}

async function dropStash(stashId) {
    return await git.stash(['drop', stashId]);
}

// Merge Operations
async function performMerge(branch) {
    try {
        await git.merge([branch]);
        return { success: true, message: `Merged branch ${branch} successfully.` };
    } catch (error) {
        throw new Error(`Merge failed: ${error.message}`);
    }
}

// Rebase Operations
async function performRebase(branch) {
    try {
        await git.rebase([branch]);
        return { success: true, message: `Rebased onto branch ${branch} successfully.` };
    } catch (error) {
        throw new Error(`Rebase failed: ${error.message}`);
    }
}

// Remote Operations
async function cloneRepository(repositoryUrl, directory) {
    try {
        await git.clone(repositoryUrl, directory);
        return { success: true, message: `Cloned into ${directory} successfully.` };
    } catch (error) {
        throw new Error(`Clone failed: ${error.message}`);
    }
}

async function fetchUpdates() {
    try {
        await git.fetch();
        return { success: true, message: 'Fetched updates successfully.' };
    } catch (error) {
        throw new Error(`Fetch failed: ${error.message}`);
    }
}

async function pullUpdates() {
    try {
        await git.pull();
        return { success: true, message: 'Pulled updates successfully.' };
    } catch (error) {
        throw new Error(`Pull failed: ${error.message}`);
    }
}

async function pushChanges() {
    try {
        await git.push();
        return { success: true, message: 'Pushed changes successfully.' };
    } catch (error) {
        throw new Error(`Push failed: ${error.message}`);
    }
}

module.exports = {
    addFiles,
    commitChanges,
    getCommitLogs,
    revertToCommit,
    getDiffs,
    listBranches,
    createBranch,
    deleteBranch,
    listTags,
    createTag,
    deleteTag,
    getStatus,
    getStashList,
    createStash,
    applyStash,
    dropStash,
    performMerge,
    performRebase,
    cloneRepository,
    fetchUpdates,
    pullUpdates,
    pushChanges
};
