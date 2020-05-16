const reverseTableCheckConstraints = checkConstraints =>
	checkConstraints.map(checkConstraint => ({
		chkConstrName: checkConstraint.name,
		constrExpression: checkConstraint.definition,
		constrCheck: !checkConstraint.is_not_trusted,
		constrEnforceUpserts: !checkConstraint.is_disabled,
		constrEnforceReplication: !checkConstraint.is_not_for_replication,
	}));

module.exports = reverseTableCheckConstraints;
