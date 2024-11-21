const _ = require('lodash');

module.exports = app => {
	const { assignTemplates } = app.require('@hackolade/ddl-fe-utils');
	const { tab } = app.require('@hackolade/ddl-fe-utils').general;

	const wrapIfNotExistSchema = ({ templates, schemaStatement, schemaName, terminator }) => {
		return assignTemplates(templates.ifNotExistSchema, {
			statement: _.trim(tab(schemaStatement)),
			schemaName,
			terminator,
		});
	};

	const wrapIfNotExistDatabase = ({ templates, databaseStatement, databaseName, terminator }) => {
		return assignTemplates(templates.ifNotExistDatabase, {
			statement: tab(databaseStatement),
			databaseName,
			terminator,
		});
	};

	const wrapIfNotExistTable = ({ templates, tableStatement, tableName, terminator }) => {
		return assignTemplates(templates.ifNotExistTable, {
			statement: tab(tableStatement),
			tableName,
			terminator,
		});
	};

	const wrapIfNotExistView = ({ templates, viewStatement, viewName, terminator }) => {
		return assignTemplates(templates.ifNotExistView, {
			statement: tab(viewStatement),
			viewName,
			terminator,
		});
	};

	return {
		wrapIfNotExistSchema,
		wrapIfNotExistDatabase,
		wrapIfNotExistTable,
		wrapIfNotExistView,
	};
};
