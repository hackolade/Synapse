const BEFORE_DEACTIVATED_STATEMENT = '-- ';

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

module.exports = { 
	commentIfDeactivated,
	queryIsDeactivated,	
};
