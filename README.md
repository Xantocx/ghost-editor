# Ghost Editor

## Description

This project is the attempt on an editor for creative coding based on Microsoft's Monaco Editor. Its mainly designed for the P5JS creative coding library for JavaScript and supports a novel versioning approach, as well as a real-time preview with error feedback. ChatGPT is used to provide helpful insights on both, versions and errors as well.


## Setup

This project is built using Electron and NodeJS and uses Electron Forge for its build process. As such, it supports hot-reloading for the frontend (Electron renderer), and can easily be built for different platforms. Prisma is used as an ORM for SQLite for the database, which is deployed and migrated locally during the first execution of the program. Setup requires the following steps:

1. Install NodeJS and `npm`.
2. Clone the repository to your system and open it in Visual Studio Code (the latter is a recommendation, but it helps if you want to work with Prisma, as there are helpful plugins).
3. Run `npm install` in the repository.
4. Create a `.env` file at the project root following this template:

```
DATABASE_FILENAME="database_filename.db"
DATABASE_URL="file:database_filename.db"

# NOTE: Currently, some functionality will just break when no or a invalid key is provided.
# This is a known bug and should be fixed in the future.
OPENAI_API_KEY="your_openai_api_key"
```

5. Run `npm start` to start the development server. This will launch a instance of the editor in development mode, with hot-reload for the frontend.
6. Run `npm run make` to build an installer/executable for your platform. Note: This is only tested on Windows so far!


## Notes

- Manually downgraded css-loader@5.2.7 for webpack to make the . See https://github.com/microsoft/monaco-editor/issues/2930.
- The build setup with Electron Forge is based on the webpack-typescript template, but was heavily altered to allow for both, a working development and production build including the database functionality. So keep that in mind when exploring the project. Not all of that might be the overall best solution, but it works. Hints for some choices can be found throughout the code.
- The `docker-compose.yaml` file is currently not needed anymore. It was used for a server-based database approach, and might make a comeback in the future.
- This README is by no means complete and only provides an inital baseline. It will be expanded in the future.