const algolia = require('algoliasearch');
const HttpsAgent = require('agentkeepalive').HttpsAgent;
const keepaliveAgent = new HttpsAgent({
  maxSockets: 1,
  maxKeepAliveRequests: 0, // no limit on max requests per keepalive socket
  maxKeepAliveTime: 30000, // keepalive for 30 seconds
});
const readLine = require('readline');
const Base = require('./Base.js');

class DeleteIndicesPatternScript extends Base {
  constructor() {
    super();
    // Define validation constants
    this.message =
      "\nUsage: $ algolia deleteindices -a algoliaappid -k algoliaapikey -r 'regexp for filtering' -x\n\n";
    this.params = ['algoliaappid', 'algoliaapikey', 'regexp', 'dryrun'];
  }

  writeProgress(count) {
    readLine.cursorTo(process.stdout, 0);
    process.stdout.write(`Deleted indices: ${count}`);
  }

  removeReplicas({ indices, regexp, dryRun }) {
    return Promise.all(
      indices.map(async ({ name: indexName }) => {
        const index = await this.client.initIndex(indexName);
        const indexSettings = await index.getSettings();
        const replicas = indexSettings.slaves || indexSettings.replicas;
        if (replicas !== undefined && replicas.length > 0) {
          const newReplicas = replicas.filter(
            replicaIndexName => regexp.test(replicaIndexName) === false
          );

          if (replicas.length !== newReplicas.length) {
            if (dryRun === false) {
              const { taskID } = await index.setSettings({
                [indexSettings.slaves !== undefined
                  ? 'slaves'
                  : 'replicas']: newReplicas,
              });
              await index.waitTask(taskID);
            } else {
              console.log(
                `[DRY RUN] Replicas change on index ${indexName}, \n- before: ${replicas.join(
                  ','
                )}\n- after: ${newReplicas.join(',')}`
              );
            }
          }
        }

        return false;
      })
    );
  }

  deleteIndices({ indices, regexp, dryRun }) {
    let deletedIndices = 0;
    return Promise.all(
      indices
        .filter(({ name: indexName }) => regexp.test(indexName) === true)
        .map(async ({ name: indexName }) => {
          deletedIndices++;

          if (dryRun === false) {
            this.writeProgress(deletedIndices);
            const index = this.client.initIndex(indexName);
            const { taskID } = await this.client.deleteIndex(indexName);
            return index.waitTask(taskID);
          } else {
            console.log(`[DRY RUN] Delete index ${indexName}`);
            return false;
          }
        })
    ).then(() => {
      console.log('');
      if (dryRun === false) {
        console.log(`${deletedIndices} indices deleted`);
      } else {
        console.log(`[DRY RUN] ${deletedIndices} indices deleted`);
      }
    });
  }

  async deleteIndicesPattern(options) {
    this.client = algolia(options.appId, options.apiKey, keepaliveAgent);
    const { items: indices } = await this.client.listIndexes();
    const regexp = new RegExp(options.regexp);
    await this.removeReplicas({ indices, regexp, dryRun: options.dryRun });
    await this.deleteIndices({ indices, regexp, dryRun: options.dryRun });
  }

  start(program) {
    try {
      // Validate command
      const isValid = this.validate(program, this.message, this.params);
      if (isValid.flag) return console.log(isValid.output);

      // Config params
      const options = {
        appId: program.algoliaappid,
        apiKey: program.algoliaapikey,
        regexp: program.regexp,
        dryRun: program.dryrun !== undefined ? program.dryrun === 'true' : true,
      };

      // Delete indices
      return this.deleteIndicesPattern(options);
    } catch (e) {
      throw e;
    }
  }
}

module.exports = new DeleteIndicesPatternScript();
