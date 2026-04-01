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

/**
 *
 * @param {string} statement
 * @returns {Partial<Procedure>}
 */
const parseProcedureProperties = statement => {
	const createProcedureRegexp = /CREATE(?:\s+OR\s+ALTER)?\s+(?:\bPROC\b|\bPROCEDURE\b)\s*(?:[^\s(]+)\s+/i;
	const inputArgsRegexp = /^([\s\S]+)(?=\s+\bAS\b)/i;
	const bodyRegexp = /\bAS\b\s*([\s\S]+)$/i;

	const procedureString = statement.replace(createProcedureRegexp, '');
	const inputArgsString = inputArgsRegexp.exec(procedureString)?.[1];
	const bodyString = bodyRegexp.exec(procedureString)?.[1];

	const inputArgs = inputArgsString?.split(',').map(trim).join(',\n');
	const body = bodyString?.replace(/;$/, '');

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
