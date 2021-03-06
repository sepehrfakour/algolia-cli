const algolia = require('algoliasearch');
const HttpsAgent = require('agentkeepalive').HttpsAgent;
const keepaliveAgent = new HttpsAgent({
  maxSockets: 1,
  maxKeepAliveRequests: 0, // no limit on max requests per keepalive socket
  maxKeepAliveTime: 30000, // keepalive for 30 seconds
});
const Base = require('./Base.js');

class SetSettingsScript extends Base {
  constructor() {
    super();
    // Bind class methods
    this.start = this.start.bind(this);
    // Define validation constants
    this.message =
      '\nUsage: $ algolia setsettings -a algoliaappid -k algoliaapikey -n algoliaindexname -s sourcefilepath\n\n';
    this.params = [
      'algoliaappid',
      'algoliaapikey',
      'algoliaindexname',
      'sourcefilepath',
    ];
  }

  async start(program) {
    try {
      // Validate command
      const isValid = this.validate(program, this.message, this.params);
      if (isValid.flag) return console.log(isValid.output);

      // Config params
      const appId = program.algoliaappid;
      const apiKey = program.algoliaapikey;
      const indexName = program.algoliaindexname;
      const settingsPath = program.sourcefilepath;

      // Get index settings
      const settings = require(settingsPath);
      // Instantiate Algolia index
      const client = algolia(appId, apiKey, keepaliveAgent);
      const index = client.initIndex(indexName);
      // Set index settings
      const result = await index.setSettings(settings);
      return console.log(result);
    } catch (e) {
      throw e;
    }
  }
}

const setSettingsScript = new SetSettingsScript();
module.exports = setSettingsScript;
