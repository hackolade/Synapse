/**
 * @typedef {import('../types').Procedure} Procedure
 */
const { trim } = require('lodash');
const { clean, tab } = require('../utils/general');

/**
 *
 * @param {Procedure[]} [procedures]
 * @returns {Procedure[]}
 */
const hydrateProcedures = procedures => {
	if (!Array.isArray(procedures)) {
		return [];
	}

	return procedures
		.map(procedure => {
			return clean({
				name: procedure.name || undefined,
				inputArgs: procedure.inputArgs ? tab(trim(procedure.inputArgs)) : undefined,
				body: procedure.body || undefined,
			});
		})
		.filter(procedure => procedure.name);
};

module.exports = {
	hydrateProcedures,
};
