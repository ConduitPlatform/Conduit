# Database Adapter module

This module should allow for basic functionality on both SQL DBs
through (TyperORM or Sequelize) and MongoDB (Through Mongoose).
It should actually generate schemas as files and the rest of the packages
should use this package for all their needs.

This package should not implement EVERYTHING. Instead it should implement
simple find/get queries for both scenarios and the schemas. After that it 
should allow the other packages to get direct access to the schemas and the
connection instances for any advanced query needs.

It should also support multiple connections, either to different same tech DBs
ex. 2 MongoDBs or to different tech DBs. Each connection must have different schemas.
To the application each DB will be referenced by an assigned name so that the package
will know which DB to query.

It is important to implement all logic in files and not 'create' all schemas during
runtime and have their existance be logical. We need them in file format to guarantee performance  
