const BEFORE_DEACTIVATED_STATEMENT = '-- ';
const REQ_MULTY_LINE_COMMENT = /\/\*[\s\S]*?\*\//gi;

const commentIfDeactivated = (statement, data, isPartOfLine) => {
	if (data?.hasOwnProperty('isActivated') && !data.isActivated) {
		if (isPartOfLine) {
			return '/* ' + statement + ' */';
		} else if (statement.includes('\n')) {
			return '/*\n' + statement + ' */\n';
		} else {
			return BEFORE_DEACTIVATED_STATEMENT + statement;
		}
	}
	return statement;
};

const queryIsDeactivated = (query, statement) => {
	return query.includes(statement) && query.startsWith(BEFORE_DEACTIVATED_STATEMENT);
};

const filterDeactivatedQuery = query => {
	return query.replace(REQ_MULTY_LINE_COMMENT, '');
};

module.exports = { 
	commentIfDeactivated,
	queryIsDeactivated,
	filterDeactivatedQuery,
};
