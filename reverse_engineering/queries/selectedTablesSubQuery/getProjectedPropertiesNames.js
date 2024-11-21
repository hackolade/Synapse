const getProjectedPropertiesNames = ({ columnToAliasMap }) =>
	Object.fromEntries(Object.values(columnToAliasMap).map(projectedName => [projectedName, projectedName]));

module.exports = {
	getProjectedPropertiesNames,
};
