const simpleGit = require('simple-git');
const git = simpleGit();

/**
 * Commits all current changes to the git repository with the provided commit message.
 * @param {string} message - The commit message describing the changes.
 * @returns {Promise<boolean>} - A promise that resolves to true if the commit was successful, otherwise false.
 */
async function commitChanges(message) {
    try {
        await git.add('.'); // Stage all changes
        await git.commit(message); // Commit with the given message
        console.log('Changes committed to git:', message);
        return true;
    } catch (error) {
        console.error('Error committing changes:', error);
        return false;
    }
}

/**
 * Retrieves the commit logs from the git repository.
 * @returns {Promise<Array>} - A promise that resolves to an array of commit logs.
 */
async function getCommitLogs() {
    try {
        const logs = await git.log();
        return logs.all; // Return all commit logs
    } catch (error) {
        console.error('Error retrieving commit logs:', error);
        throw error; // Rethrow to handle it in the calling context
    }
}

/**
 * Reverts the repository to the state of a specific commit.
 * @param {string} commitHash - The hash of the commit to revert to.
 * @returns {Promise<boolean>} - A promise that resolves to true if the revert was successful, otherwise false.
 */
async function revertToCommit(commitHash) {
    try {
        await git.reset(['--hard', commitHash]); // Hard reset to the specified commit
        console.log(`Reverted to commit ${commitHash}`);
        return true;
    } catch (error) {
        console.error(`Error reverting to commit ${commitHash}:`, error);
        return false;
    }
}

module.exports = {
    commitChanges,
    getCommitLogs,
    revertToCommit
};
