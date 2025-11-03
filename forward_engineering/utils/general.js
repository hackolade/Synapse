const _ = require('lodash');

const checkAllKeysDeactivated = keys => (keys.length ? keys.every(key => !_.get(key, 'isActivated', true)) : false);

const clean = obj =>
	Object.entries(obj)
		.filter(([name, value]) => !_.isNil(value))
		.reduce((result, [name, value]) => ({ ...result, [name]: value }), {});

const divideIntoActivatedAndDeactivated = (items, mapFunction) => {
	const activatedItems = items.filter(item => _.get(item, 'isActivated', true)).map(mapFunction);
	const deactivatedItems = items.filter(item => !_.get(item, 'isActivated', true)).map(mapFunction);
	return { activatedItems, deactivatedItems };
};

const getDbData = containerData => {
	return { ..._.get(containerData, '[0]', {}), name: getDbName(containerData) };
};

const getDbName = containerData => {
	return _.get(containerData, '[0].code') || _.get(containerData, '[0].name', '');
};

const getEntityName = entityData => {
	return (entityData && (entityData.code || entityData.collectionName)) || '';
};

const tab = (text, tab = '\t') =>
	text
		.split('\n')
		.map(line => tab + line)
		.join('\n');

module.exports = {
	checkAllKeysDeactivated,
	clean,
	divideIntoActivatedAndDeactivated,
	getDbData,
	getDbName,
	getEntityName,
	tab,
};
