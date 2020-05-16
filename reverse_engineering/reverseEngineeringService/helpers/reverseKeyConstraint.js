const isClustered = key => !key.type_desc.includes('NONCLUSTERED');

const reverseKeyConstraint = keyConstraintInfo => ({
	constraintName: keyConstraintInfo.constraintName,
	staticticsNorecompute: Boolean(keyConstraintInfo.statisticNoRecompute),
	allowRowLocks: keyConstraintInfo.allow_row_locks,
	allowPageLocks: keyConstraintInfo.allow_page_locks,
	clustered: isClustered(keyConstraintInfo),
	ignoreDuplicate: Boolean(keyConstraintInfo.ignore_dup_key),
	isOptimizedForSequentialKey: Boolean(keyConstraintInfo.optimize_for_sequential_key),
	isPadded: Boolean(keyConstraintInfo.is_padded),
	fillFactor: keyConstraintInfo.fill_factor,
	order: keyConstraintInfo.isDescending ? 'DESC' : 'ASC',
	partitionName: keyConstraintInfo.dataSpaceName,
	statisticsIncremental: keyConstraintInfo.statisticsIncremental,
	dataCompression: keyConstraintInfo.dataCompression,
});

module.exports = reverseKeyConstraint;
