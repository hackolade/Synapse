const isClustered = key => !key.type_desc.includes('NONCLUSTERED');

const reverseKeyConstraint = keyConstraintInfo => ({
	constraintName: keyConstraintInfo.constraintName,
});

module.exports = reverseKeyConstraint;
