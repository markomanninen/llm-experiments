const express = require('express');
const { 
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
} = require('./gitOperations');

module.exports = function(app, io) {

    // Commits
    app.get('/api/commits', async (req, res) => {
        try {
            const logs = await getCommitLogs(req.query);
            res.json(logs);
        } catch (error) {
            res.status(500).send({ message: 'Failed to retrieve commit logs', error });
        }
    });

    app.post('/api/commit', async (req, res) => {
        try {
            const { message, files } = req.body;
            const result = await commitChanges(message, files);
            res.json(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to create commit', error });
        }
    });

    app.patch('/api/commit/:commitHash', async (req, res) => {
        try {
            const { message } = req.body;
            const commitHash = req.params.commitHash;
            const result = await revertToCommit(commitHash, message);
            res.json(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to amend commit', error });
        }
    });

    // Branches
    app.get('/api/branches', async (req, res) => {
        try {
            const branches = await listBranches();
            res.json(branches);
        } catch (error) {
            res.status(500).send({ message: 'Failed to list branches', error });
        }
    });

    app.post('/api/branches', async (req, res) => {
        try {
            const { name, startPoint } = req.body;
            const branch = await createBranch(name, startPoint);
            res.json(branch);
        } catch (error) {
            res.status(500).send({ message: 'Failed to create branch', error });
        }
    });

    app.delete('/api/branches/:branchName', async (req, res) => {
        try {
            const branchName = req.params.branchName;
            await deleteBranch(branchName);
            res.json({ message: 'Branch deleted successfully' });
        } catch (error) {
            res.status(500).send({ message: 'Failed to delete branch', error });
        }
    });

    // Tags
    app.get('/api/tags', async (req, res) => {
        try {
            const tags = await listTags();
            res.json(tags);
        } catch (error) {
            res.status(500).send({ message: 'Failed to list tags', error });
        }
    });

    app.post('/api/tags', async (req, res) => {
        try {
            const { name, commit } = req.body;
            const tag = await createTag(name, commit);
            res.json(tag);
        } catch (error) {
            res.status(500).send({ message: 'Failed to create tag', error });
        }
    });

    app.delete('/api/tags/:tagName', async (req, res) => {
        try {
            const tagName = req.params.tagName;
            await deleteTag(tagName);
            res.json({ message: 'Tag deleted successfully' });
        } catch (error) {
            res.status(500).send({ message: 'Failed to delete tag', error });
        }
    });

    // Diffs
    app.get('/api/diffs', async (req, res) => {
        try {
            const { from, to } = req.query;
            const diffs = await getDiffs(from, to);
            res.json({ diffs });
        } catch (error) {
            res.status(500).send({ message: 'Failed to retrieve diffs', error });
        }
    });

    // Status
    app.get('/api/status', async (req, res) => {
        try {
            const status = await getStatus();
            res.json(status);
        } catch (error) {
            res.status(500).send({ message: 'Failed to get status', error });
        }
    });

    // Stash
    app.get('/api/stash', async (req, res) => {
        try {
            const stashes = await getStashList();
            res.json(stashes);
        } catch (error) {
            res.status(500).send({ message: 'Failed to list stashes', error });
        }
    });

    app.post('/api/stash', async (req, res) => {
        try {
            const { message } = req.body;
            const stash = await createStash(message);
            res.json(stash);
        } catch (error) {
            res.status(500).send({ message: 'Failed to create stash', error });
        }
    });

    app.post('/api/stash/apply', async (req, res) => {
        try {
            const { stashId } = req.body;
            const result = await applyStash(stashId);
            res.json(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to apply stash', error });
        }
    });
 
    app.delete('/api/stash/:stashId', async (req, res) => {
        try {
            const stashId = req.params.stashId;
            await dropStash(stashId);
            res.json({ message: 'Stash dropped successfully' });
        } catch (error) {
            res.status(500).send({ message: 'Failed to drop stash', error });
        }
    });

    // Merge and Rebase
    app.post('/api/merge', async (req, res) => {
        try {
            const { branch } = req.body;
            const result = await performMerge(branch);
            res.json(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to merge branches', error });
        }
    });

    app.post('/api/rebase', async (req, res) => {
        try {
            const { branch } = req.body;
            const result = await performRebase(branch);
            res.json(result);
        } catch (error) {
            res.status(500).send({ message: 'Failed to rebase branches', error });
        }
    });

    // Remote operations: clone, fetch, pull, push
    app.post('/api/clone', async (req, res) => {
        try {
            const { repositoryUrl, directory } = req.body;
            const result = await cloneRepository(repositoryUrl, directory);
            res.json({ message: 'Repository cloned successfully', details: result });
        } catch (error) {
            res.status(500).send({ message: 'Failed to clone repository', error });
        }
    });

    app.post('/api/fetch', async (req, res) => {
        try {
            const result = await fetchUpdates();
            res.json({ message: 'Fetched updates successfully', details: result });
        } catch (error) {
            res.status(500).send({ message: 'Failed to fetch updates', error });
        }
    });

    app.post('/api/pull', async (req, res) => {
        try {
            const result = await pullUpdates();
            res.json({ message: 'Pulled updates successfully', details: result });
        } catch (error) {
            res.status(500).send({ message: 'Failed to pull updates', error });
        }
    });
    
    app.post('/api/push', async (req, res) => {
        try {
            const result = await pushChanges();
            res.json({ message: 'Pushed changes successfully', details: result });
        } catch (error) {
            res.status(500).send({ message: 'Failed to push changes', error });
        }
    });
};
