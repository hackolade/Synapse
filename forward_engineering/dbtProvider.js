/**
 * @typedef {import('./types').ColumnDefinition} ColumnDefinition
 * @typedef {import('./types').JsonSchema} JsonSchema
 * @typedef {import('./types').ConstraintDto} ConstraintDto
 */
const { toLower, toUpper } = require('lodash');

const types = require('./configs/types');
const defaultTypes = require('./configs/defaultTypes');
const { decorateType } = require('./helpers/columnDefinitionHelper');
const keyHelper = require('./helpers/keyHelper');

class DbtProvider {
	/**
	 * @returns {DbtProvider}
	 */
	static createDbtProvider() {
		return new DbtProvider();
	}

	/**
	 * @param {string} type
	 * @returns {string | undefined}
	 */
	getDefaultType(type) {
		return defaultTypes[type];
	}

	/**
	 * @returns {Record<string, object>}
	 */
	getTypesDescriptors() {
		return types;
	}

	/**
	 * @param {string} type
	 * @returns {boolean}
	 */
	hasType(type) {
		return Object.keys(types).map(toLower).includes(toLower(type));
	}

	/**
	 * @param {{ type: string; columnDefinition: ColumnDefinition }}
	 * @returns {string}
	 */
	decorateType({ type, columnDefinition }) {
		return decorateType(toUpper(type), columnDefinition);
	}

	/**
	 * @param {{ jsonSchema: JsonSchema }}
	 * @returns {ConstraintDto[]}
	 */
	getCompositeKeyConstraints({ jsonSchema }) {
		return keyHelper.getCompositeKeyConstraints({ jsonSchema });
	}

	/**
	 * @param {{ columnDefinition: ColumnDefinition; jsonSchema: JsonSchema }}
	 * @returns {ConstraintDto[]}
	 */
	getColumnConstraints({ columnDefinition, jsonSchema }) {
		return keyHelper.getColumnConstraints({ columnDefinition });
	}

	/**
	 * @param {{ modelData: object[]; containerData: object[]; entityData: object[];}}
	 * @returns {{ databaseName?: string, schemaName?: string }}
	 */
	getEntityProperties({ modelData, containerData, entityData }) {
		return {
			databaseName: containerData?.[0]?.databaseName,
			schemaName: containerData?.[0]?.code ?? containerData?.[0]?.name,
		};
	}
}

module.exports = DbtProvider;
