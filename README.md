# khanos.backend 😍

The Express API behind my site. Three small services that each solve a real problem I had, kept
behind a shared middleware stack and covered by tests.

> Live: **[khanos-backend.herokuapp.com](https://khanos-backend.herokuapp.com)**

## What it does

| Endpoint | Purpose |
| --- | --- |
| `GET /github/getCommits/:word` | Search my commit history by keyword |
| `GET /github/getCommitsByRepoAndOwner/:owner/:repo` | Commits for a specific repository |
| `GET /url` · `POST /url/create` · `GET /url/:short_url` · `DELETE /url/delete/:short_url` | Mongoose-backed URL shortener |
| `GET /gemini/getFromText` · `GET /gemini/getChatFromText/:prompt` | Gemini text and chat prompts |
| `POST /gemini/getFromImage` | Gemini image prompts, 2 MB upload cap |

Every request passes through `helmet`, CORS, `compression`, `express-rate-limit`, `express-session`
and a single error-handling middleware, so no route does its own error plumbing. Controllers,
services and models stay in separate layers: controllers handle HTTP, services own the outbound
calls, models own the data.

## Getting Started

To get started with the project, clone the repository and install the dependencies:

```sh
git clone https://github.com/Khanos/khanos.backend.git
cd khanos.backend
npm install
```

## Running the Application

To start the application, use the following command:
```sh
npm start
```
The application will start and listen on port 3000.

## Develop

To start the application in development mode, use the following command:

```sh
npm run dev
```
The application starts with hot reload and request logging enabled.

## Testing

To run the tests and code coverage run the following command:
```sh
npm run test
```

To run the tests and watch for changes on the files, run the following command:
```sh
npm run test:watch
```

## Project Structure
The project has the following structure:

- **api/:** Contains the controllers, middlewares, models, routes, and services for the application.
- **public/:** Contains the static files served by the application.
- **tests/:** Contains the test files for the application.
- **views/:** Contains the view templates for the application.

### Controllers
- **MainController.js:** Handles the main routes of the application.
- **GithubController.js:** Handles the GitHub-related routes of the application.
- **GeminiController.js:** Handles the Gemini-related routes of the application.
- **UrlShortenerController.js:** Handles the URL shortening related routes of the application.

### Services
- **GithubService.js:** Service to interact with the GitHub API.
- **GeminiService.js:** Service to interact with the Gemini API.
- **UrlShortenerService.js:** Short-code generation and lookup for the URL shortener.

### Middlewares
- **errorHandler.js:** Central error handler; every route delegates its failures here.

### Models
- **UrlModel.js:** Model for URL data.

### License
Licensed under the [GNU Lesser General Public License v3.0](LICENSE).
