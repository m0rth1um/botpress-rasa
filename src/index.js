import axios from 'axios'

let config = null
let service = null

const setRasaClient = () => {
  const client = axios.create({
    baseURL: config.rasaAddress,
  })

  service = (message) => {
    message = message
              .toLowerCase()
              .replace(/[\u00E1\u00E0\u00E2\u00E4]/g, 'a')
              .replace(/[\u00FA\u00F9\u00FB\u00FC]/g, 'u')
              .replace(/[\u00F3\u00F2\u00F4\u00F6]/g, 'u')
    let serviceUri = '/parse?q=' + message + '&project=' + config.rasaProject;
    return client.get(serviceUri);
  }
}

const incomingMiddleware = (event, next) => {

  if (["message", "postback", "text", "quick_reply"].includes(event.type)) {
    service(event.text)
      .then(({data}) => {
        event.rasa_nlu = data
        next()
      })
      .catch(err => {
        if (err.response) {
          var errStatus = err.response.status;
          var errMessage = err.response.data.error;
          event.bp.logger.error('botpress-rasa_nlu', 'Status', errStatus, '- Could not process incoming text:', errMessage);
          next()
        }
        else {
          event.bp.logger.error('botpress-rasa_nlu', 'Error code:', err.code, '- Check your Rasa server address on module options');
          next()
        }
      })
  } else {
    next()
  }

}

module.exports = {

  config: {
    rasaAddress: { type: 'string', default: 'http://localhost:5000', env: 'RASA_ADDRESS' },
    rasaProject: { type: 'string', default: 'default', env: 'RASA_PROJECT' },
  },

  init: async function(bp, configurator) {

    bp.middlewares.register({
      name: 'rasa_nlu.incoming',
      module: 'botpress-rasa_nlu',
      type: 'incoming',
      handler: incomingMiddleware,
      order: 10,
      description: 'Process natural language in the form of text. Structured data with an action and parameters for that action is injected in the incoming message event.'
    })

    config = await configurator.loadAll()
    setRasaClient()
  },

  ready: async function(bp, configurator) {

    const router = bp.getRouter('botpress-rasa_nlu')

    router.get('/config', async (req, res) => {
      res.send(await configurator.loadAll())
    })

    router.post('/config', async (req, res) => {
      const { rasaAddress, rasaProject } = req.body
      await configurator.saveAll({ rasaAddress, rasaProject })
      config = await configurator.loadAll()
      setRasaClient()
      res.sendStatus(200)
    })

  }
}
