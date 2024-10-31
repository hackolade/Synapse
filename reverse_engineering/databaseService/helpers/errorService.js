/**
 *
 * @param {{message: string}} param
 * @returns {boolean}
 */
const isDisabledPublicClientFlowsError = ({ message }) => {
	const DISABLED_PUBLIC_CLIENT_FLOWS_ERROR_ID = 'AADSTS7000218';

	return message.includes(DISABLED_PUBLIC_CLIENT_FLOWS_ERROR_ID);
};

/**
 *
 * @param {{message: string}} param
 * @returns {boolean}
 */
const isConsentRequiredError = ({ message }) => {
	const CONSENT_REQUIRED_ERROR_ID = 'AADSTS65001';

	return message.includes(CONSENT_REQUIRED_ERROR_ID);
};

/**
 *
 * @param {{error: object, newMessage: string, newStackTrace: string}} param
 * @returns {object}
 */
const updateErrorMessageAndStack = ({ error, newMessage, newStackTrace }) => ({
	code: error.code,
	name: error.name,
	message: newMessage,
	stack: newStackTrace,
});

/**
 *
 * @param {{clientId: string}} param
 * @returns {string}
 */
const getConsentRequiredErrorMessage = ({ clientId }) => {
	const consentLink = `https://login.microsoftonline.com/organizations/adminconsent?client_id=${clientId}`;

	return `Your Azure administrator needs to grant tenant-wide consent to the Hackolade application using the link below: ${consentLink}`;
};

/**
 *
 * @param {{match: string}} param
 * @returns {string}
 */
const getClientIdFromErrorMessage = ({ message }) => {
	const clientIdRegularExpression = new RegExp(/'[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}'/gim);
	const clientIdMatches = message.match(clientIdRegularExpression);

	if (clientIdMatches.length === 0) {
		return 'Unknown';
	}

	const [clientId] = clientIdMatches;
	const clientIdWithoutQuotes = clientId.slice(1, clientId.length - 1);

	return clientIdWithoutQuotes;
};

/**
 *
 * @param {{error}} param
 * @returns {object[]}
 */
const getOriginalErrors = ({ error }) => {
	const originalErrors = error?.originalError?.errors;
	if (originalErrors) {
		return originalErrors;
	}

	const originalError = error?.originalError;
	if (originalError) {
		return [originalError];
	}

	return [];
};

/**
 *
 * @param {{error: object}} param
 * @returns {object}
 */
const prepareError = ({ error }) => {
	const originalErrors = getOriginalErrors({ error });
	if (!originalErrors.length) {
		return error;
	}

	const initialErrorDataIndex = originalErrors.length - 1;
	const initialError = originalErrors[initialErrorDataIndex];

	const fullStackTrace = originalErrors.map(({ stack }) => stack).join('\n\n');

	const isInitialErrorConsentRequiredError = isConsentRequiredError(initialError);
	if (isInitialErrorConsentRequiredError) {
		const clientId = getClientIdFromErrorMessage({ message: initialError.message });
		const newErrorMessage = getConsentRequiredErrorMessage({ clientId });

		return updateErrorMessageAndStack({ error, newMessage: newErrorMessage, newStackTrace: fullStackTrace });
	}

	const isInitialErrorDisabledPublicClientFlowsError = isDisabledPublicClientFlowsError(initialError);
	if (isInitialErrorDisabledPublicClientFlowsError) {
		const newErrorMessage = 'You need to allow Public client flows for the Entra ID application';

		return updateErrorMessageAndStack({ error, newMessage: newErrorMessage, newStackTrace: fullStackTrace });
	}

	return updateErrorMessageAndStack({ error, newMessage: initialError.message, newStackTrace: fullStackTrace });
};

module.exports = {
	prepareError,
};
