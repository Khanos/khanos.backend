# khanos.backend

This is a Node.js application that serves as the backend for the Khanos project. It includes a set of APIs and middlewares to handle requests and responses.

> [Check it out: https://khanos-backend.herokuapp.com](https://khanos-backend.herokuapp.com)

## Getting Started

To get started with the project, clone the repository and install the dependencies:

```sh
git clone https://github.com/yourusername/khanos.backend.git
cd khanos.backend
npm install
```

## Running the Application

To start the application, use the following command:
```sh
npm start
```
The application will start and listen on port 3000.

## Devlop

To start the application in development mode, use the following command:

```sh
npm run dev
```
The application will start and listen for changes to handle hotreload, also loggin should be available.

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

### Middlewares
- **decodeUri.js:** Middleware to decode URIs.
- **errorHandler.js:** Middleware to handle errors.

### Services
- **GithubService.js:** Service to interact with the GitHub API.

### Models
- **UrlModel.js:** Model for URL data.

### License
This project is licensed under the terms of the MIT license.
