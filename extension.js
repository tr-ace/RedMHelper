const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let activeDecorationType;  // Store the decoration type globally within the scope of the extension

function createNativeHoverMessage(details) {
/*
`NAME` Namespace: **CATEGORY**
**Parameters:** ( `x`<*Type*> , `y`<*Type*> , `z`<*Type*> )
**Returns:** <*Type*>  
**Description:** Adds an output for the specified audio submix.
*/
	const name = details['name'];
	const category = details['ns']
	const params = details['params'];
	const results = details['results'];
	let description = details['description'];
	
	let messages = [
		`**${category}** : \`${name}\`\n\n`
	];

	let paramsMessage = "";
	let formattedParams = []

	params.forEach(param => {
		const paramName = param['name']
		const paramType = param['type'];
		let tempMessage = `${paramName} : \`${paramType}\``;
		formattedParams.push(tempMessage);
	});

	if (params.length > 0) {
		const formattedParamsStr = formattedParams.join(" , ");
		paramsMessage = `**Parameters:** ( ${formattedParamsStr} )\n\n`;
		messages.push(paramsMessage);
	}

	let returnMessage = "";
	if (results) {
		returnMessage = `**Returns**: \`${results}\`\n\n`;
		messages.push(returnMessage);
	}

	let descriptionMessage = "";
	if (description) {
		description = description.replace("```\n", "");
		description = description.replace("\n```", "");
		descriptionMessage = `**Description**: ${description}\n\n`;
		messages.push(descriptionMessage);
	}

	return messages.join("");
}


function activate(context) {


	function matchNatives(editor) {
        const doc = editor.document;
        const text = doc.getText();

		let decorationsArray = [];
		// Load JSON data
		const jsonPath = path.join(__dirname, 'data/natives.json');
		const jsonData = fs.readFileSync(jsonPath, 'utf8');
		const data = JSON.parse(jsonData);
	
	
		// Loop through each top-level key in the JSON (e.g., 'CFX', 'AnotherCategory', etc.)
		Object.keys(data).forEach(category => {
			const entries = data[category];
			Object.keys(entries).forEach(key => {
				const regex = new RegExp('\(' + key + '\)', 'g');
				let match;
				
				const nativeDetails = data[category][key];
				const hoverMessage = createNativeHoverMessage(nativeDetails);
				const hoverMessageMarkdown =  new vscode.MarkdownString(hoverMessage);
				
				while ((match = regex.exec(text)) !== null) {
					const startPos = doc.positionAt(match.index);
					const endPos = doc.positionAt(match.index + match[0].length);
					const decoration = {
						range: new vscode.Range(startPos, endPos),
						hoverMessage: hoverMessageMarkdown
					};
					decorationsArray.push(decoration);
				}
			});
		});
	
		return decorationsArray;
	}
	
	function matchImages(editor, imageFolder) {
        const doc = editor.document;
        const text = doc.getText();

		let decorationsArray = [];
		// Load JSON data
		const jsonPath = path.join(__dirname, `data/${imageFolder}.json`);
		const jsonData = fs.readFileSync(jsonPath, 'utf8');
		const data = JSON.parse(jsonData);

		Object.keys(data).forEach(blipCode => {
			const regex = new RegExp(blipCode, 'g');
			let match;
			const imageName = data[blipCode];
			const imageUri = vscode.Uri.file(path.join(context.extensionPath, 'images', path.sep, imageFolder, path.sep,`${imageName}.png`));    

			const hoverMessageMarkdown =  new vscode.MarkdownString(`
| Image       | Name        |
| ----------- | ----------- |
| ![${imageName}](${imageUri}) | ${imageName} |`);

			hoverMessageMarkdown.isTrusted = true;
			while ((match = regex.exec(text)) !== null) {
				const startPos = doc.positionAt(match.index);
				const endPos = doc.positionAt(match.index + match[0].length);

				const decoration = {
					range: new vscode.Range(startPos, endPos),
					hoverMessage: hoverMessageMarkdown
				};
				
				decorationsArray.push(decoration);
			}
		});
	
		
		return decorationsArray;
	}


    function updateLuaFile(editor) {
        if (!editor) {
            vscode.window.showInformationMessage('No document is open');
            return;
        }

        if (!activeDecorationType) {
            activeDecorationType = vscode.window.createTextEditorDecorationType({
                // Specify your decoration properties here
				backgroundColor: 'rgba(239, 239, 239, 0.1)',
				// borderColor: 'red',
				// borderStyle: 'solid',
				// borderWidth: '1px',
            });
        } else {
            // Clear existing decorations before setting new ones
            editor.setDecorations(activeDecorationType, []);
        }

		let decorations = [];  // Array to store all decorations

		const nativeDecorations = matchNatives(editor);
		decorations = decorations.concat(nativeDecorations);

		const imageFolderNames = ["blips", "overhead", "pm_awards_mp", "multiwheel_emotes"];

		imageFolderNames.forEach(folderName => {
			const imageDecorations = matchImages(editor, folderName);
			decorations = decorations.concat(imageDecorations);
		});

		// Apply decorations if any matches were found
		if (decorations.length > 0) {
			editor.setDecorations(activeDecorationType, decorations);
		}
    };

    // Subscribe to text editor activation events
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (activeDecorationType) {
            editor.setDecorations(activeDecorationType, []);  // Clear previous decorations
			updateLuaFile(editor);
        }
    }, null, context.subscriptions);

    // Subscribe to text document change events
    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
            updateLuaFile(editor);
        }
    }, null, context.subscriptions);

    // Check the currently open text editor on extension activation
    if (vscode.window.activeTextEditor) {
        updateLuaFile(vscode.window.activeTextEditor);
    }
}

function deactivate() {
    if (activeDecorationType) {
        activeDecorationType.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};
