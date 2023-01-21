const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY || 'NOAPIKEY',
});
const openai = new OpenAIApi(configuration);
const maxTokens = 1000;

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
};