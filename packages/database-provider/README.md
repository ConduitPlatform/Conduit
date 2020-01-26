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

# Mongoose Adapter module

This module will be required by the database-adapter, depending on configuration,
and will allow for basic query execution through its functions, access to the underlying connector,
direct-model access, mongoose schema generation through .json models.

# Sequelize Adapter module

This module will be required by the database-adapter, depending on configuration,
and will allow for basic query execution through its functions, access to the underlying connector,
direct-model access, sql schema generation through .json models.


#NOTE

Mongoose and sequelize where selected due to their similar nature, so that we can maintain 
a compatibility layer fairly easily. This provider would probably be best to be exported as 
a library down the road. The purpose of the library should be to provide a compatibility between MongoDB
and sequelize. 
