const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY || 'NOAPIKEY',
});
const openai = new OpenAIApi(configuration);
const maxTokens = 1000;
const b64jsonImage = require('../mockedData/b64jsonImage');

module.exports ={
    getResponse: async (req, res) => {
        const text = req.params.text;
        try {
            const completion = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: `${text}`,
                temperature: 0,
                max_tokens: maxTokens,
            });
            return res.json({
                input: text,
                output: completion.data.choices[0].text,
                message: 'Success',
                error: false,
            });
        } catch (error) {
            if(error.response && error.response.status === 401) {
                return res.json({
                    message: 'Invalid API key',
                    error: true,
                    fullError: error,
                });
            }
            return res.json({
                message: error.message || 'Error getting response',
                error: true,
                fullError: error,
            });
        }
    },
    getImage: async (req, res) => {
        const text = req.params.text;
        try {
            const aiResponse = await openai.createImage({
                prompt: `${text}`,
                n: 1,
                size: '512x512',
              });
            const image = aiResponse.data.data[0].url;
            return res.status(200).json({
                input: text,
                output: image,
                message: 'Success',
                error: false,
            });
        } catch (error) {
            if(error.response && error.response.status === 401) {
                return res.status(401).json({
                    message: 'Invalid API key',
                    error: true,
                    fullError: error,
                });
            }
            return res.status(500).json({
                message: error.message || 'Error getting image',
                error: true,
                fullError: error,
            });
        }
    },
    // Mocked responses
    getMockedResponse: async (req, res) => {
        const text = req.params.text;
        return res.json({
            input: text,
            output: `This is a mocked response for ${text}`,
            message: 'Success',
            error: false,
        });
    },
    getMockedImage: async (req, res) => {
        const text = req.params.text;
        const image = b64jsonImage;
        return res.json({
            input: text,
            output: image,
            message: 'Success',
            error: false,
        });
    }
};