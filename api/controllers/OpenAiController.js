const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

module.exports ={
    getResponse: async (req, res) => {
        const text = req.params.text;
        try {
            const completion = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: `${text}`,
                temperature: 0,
                max_tokens: 100,
            });
            return res.json({
                text: completion.data.choices[0].text,
                data: completion.data,
                message: 'Success',
                error: false,
            });
        } catch (error) {
            return res.json({
                message: error.message || 'Error getting response',
                error: true,
                fullError: error,
            });
        }
    },
};