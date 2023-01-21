const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const translate = require('translatte');

module.exports ={
    getResponse: async (req, res) => {
        const text = req.params.text;
        try {
            const translatedText = await translate(text, {to: 'en'});
            if(!translatedText.text) {
                throw new Error('Error translating text');
            }
            const completion = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: `${translatedText.text}`,
                temperature: 0,
                max_tokens: 100,
            });
            let translatedResponse;
            if(translatedText.from.language.iso !== 'en') {
                translatedResponse = await translate(completion.data.choices[0].text, {to: translatedText.from.language.iso});
                if(!translatedResponse.text) {
                    throw new Error('Error translating response');
                }
            } else {
                translatedResponse = completion.data.choices[0].text;
            }
            return res.json({
                text: translatedResponse,
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