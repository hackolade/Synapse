/**
 * @param {Response} response
 */
async function parseResponse(response) {
	if (response.status !== 200) {
		const errorMessage = await response.text();
		throw new Error(errorMessage);
	}

	return response.json();
}

module.exports = { parseResponse };
