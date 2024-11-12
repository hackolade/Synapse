const getProjectedPropertiesNames = ({ projection }) =>
	Object.fromEntries(Object.values(projection).map(projectedName => [projectedName, projectedName]));

module.exports = {
	getProjectedPropertiesNames,
};
