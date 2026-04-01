const { trim } = require('lodash');
/**
 * @typedef {object} RawProcedure
 * @property {string} schema_name
 * @property {string} procedure_name
 * @property {string|null} procedure_body
 *
 * @typedef {object} Procedure
 * @property {string} name
 * @property {string} schemaName
 * @property {boolean} orReplace
 * @property {string} [inputArgs]
 * @property {string} [body]
 */

const parseProcedureProperties = statement => {
	const createProcedureRegexp = /CREATE(?:\s+OR\s+ALTER)?\s+(?:\bPROC|\bPROCEDURE)\s*(?:[^\s(]+)\s+/gi;
	const procedurePropertiesRegexp =
		/(?<inputArgs>\((?:[^()']+|'[^']*'|\([^()]*\))*\)|(?:\s*@\w+[^@]*?)*?)?\s*AS\s*(?<body>[\s\S]+)/gi;

	const procedureStatement = statement.replace(createProcedureRegexp, '');
	const { groups } = procedurePropertiesRegexp.exec(procedureStatement);
	const inputArgs = groups.inputArgs?.split(',').map(trim).join(',\n');
	const body = groups.body?.replace(/;$/, '');

	return {
		inputArgs,
		body,
	};
};

/**
 *
 * @param {{ log: (logType: string, error: Error, message: string) => void }} logger
 * @returns {(rawProcedure: RawProcedure) => Procedure}
 */
const parseProcedure = logger => rawProcedure => {
	const { schema_name, procedure_name, procedure_body } = rawProcedure;

	try {
		const { inputArgs, body } = parseProcedureProperties(procedure_body);

		return {
			name: procedure_name,
			schemaName: schema_name,
			inputArgs,
			body,
		};
	} catch (error) {
		logger.log(
			'error',
			{ message: error.message, stack: error.stack, error },
			`Error parsing procedure ${schema_name}.${procedure_name}`,
		);

		return {
			name: procedure_name,
			schemaName: schema_name,
		};
	}
};

module.exports = {
	parseProcedure,
};
