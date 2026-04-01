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

const createProcedureRegexp =
	/CREATE(?<orReplace>\s*OR\s*ALTER)?\s*(?:PROC|PROCEDURE)\s*(?:[^\s(]+)\s*(?<inputArgs>\((?:[^()']+|'[^']*'|\([^()]*\))*\)|(?:\s*@\w+[^@]*?)*?)?\s*AS\s*(?<body>[\s\S]+)/i;

/**
 *
 * @param {string} [args]
 * @returns {string|undefined}
 */
const formatArgs = args => {
	if (typeof args === 'string') {
		return args.split(',').map(trim).join(',\n');
	}
};

/**
 *
 * @param {string} [body]
 * @returns {string|undefined}
 */
const formatBody = body => {
	if (typeof body === 'string') {
		return body.replace(/;$/, '');
	}
};

/**
 *
 * @param {{ log: (logType: string, error: Error, message: string) => void }} logger
 * @returns {(rawProcedure: RawProcedure) => Procedure}
 */
const parseProcedure = logger => rawProcedure => {
	const { schema_name, procedure_name, procedure_body } = rawProcedure;

	try {
		const result = createProcedureRegexp.exec(procedure_body);
		const { inputArgs, body } = result.groups;

		return {
			name: procedure_name,
			schemaName: schema_name,
			inputArgs: formatArgs(inputArgs),
			body: formatBody(body),
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
