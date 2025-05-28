import { examples } from './examples.js';

interface GeminiResponse {
  candidates?: {
    content: {
      parts: { text: string }[];
    };
  }[];
  error?: { message: string };
}

const DOM = {
  inputText: document.getElementById('inputText') as HTMLTextAreaElement,
  outputDiv: document.getElementById('output') as HTMLElement,
  resultDiv: document.getElementById('result') as HTMLElement,
  processMessage: document.getElementById('processMessage') as HTMLElement,
  copyLabel: document.getElementById('copyLabel') as HTMLElement,
  processButton: document.getElementById('processButton') as HTMLButtonElement,
  copyButton: document.getElementById('copyButton') as HTMLButtonElement,
  openOptions: document.getElementById('openOptions') as HTMLButtonElement,
  smartMode: document.getElementById('smart-mode') as HTMLInputElement
};

const setProcessMessage = (msg: string, isError: boolean): void => {
  DOM.processMessage.textContent = msg;
  DOM.processMessage.style.color = isError ? 'red' : 'gray';
  DOM.processMessage.style.display = msg ? 'block' : 'none';
};

const getGeminiApiKey = (): Promise<string> =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.get('geminiApiKey', (data: { geminiApiKey?: string }) => {
      data.geminiApiKey
        ? resolve(data.geminiApiKey)
        : reject(new Error('Please set your API key in the extension settings.'));
    });
  });

const buildPrompt = (inputText: string): string => {
  const examplesText = Object.keys(examples)
    .map((lang) => {
      const arr = examples[lang];
      const randomExample = arr[Math.floor(Math.random() * arr.length)];
      return `\nInput: "${randomExample.input}"\nOutput: "${randomExample.output}"\n`;
    })
    .join("");

  return `\
Insert only missing accent marks into the text. Do not change any letters, punctuation, or spacing.
Examples:${examplesText}
Output only the text with added accents.
Input: ${inputText}
`;
};

const validateAccents = (input: string, output: string): boolean => {
  const removeAccents = (str: string): string =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clean = (str: string): string => removeAccents(str).trim().replace(/\s+/g, ' ');
  return clean(input) === clean(output);
};

const fetchProcessedText = (inputText: string, apiKey: string): Promise<string> => {
  const model = DOM.smartMode.checked ? 'gemini-2.5-pro-exp-03-25' : 'gemini-2.0-flash'; // update to latest model
  const promptText = buildPrompt(inputText);
  const payload = { contents: [{ parts: [{ text: promptText }] }] };

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  )
    .then((response) => {
      if (response.status === 429) {
        return Promise.reject(new Error("API limit has been exhausted. Please retry later."));
      }
      if (!response.headers.get('content-type')?.includes('application/json')) {
        return Promise.reject(
          new Error('Unexpected response format. Check that your API key is correct.')
        );
      }
      return response.json() as Promise<GeminiResponse>;
    })
    .then((dataJson) => {
      const parts = dataJson.candidates?.[0]?.content?.parts;
      return parts?.[0]?.text
        ? Promise.resolve(parts[0].text)
        : Promise.reject(new Error(`Unexpected response from server: ${JSON.stringify(dataJson)}`));
    });
};

const retryIfNeeded = (
  inputText: string,
  processedText: string,
  attempt: number
): Promise<string> => {
  if (validateAccents(inputText, processedText)) {
    return Promise.resolve(processedText);
  }

  if (attempt < 1) {
    setProcessMessage('Validating...', false);
    return processInput(inputText, attempt + 1);
  }

  const msg =
    "Response could not be validated." +
    (DOM.smartMode.checked ? "" : " Please try again with Smart Mode enabled.");
  setProcessMessage(msg, true);
  return Promise.resolve(processedText);
};

const processInput = (inputText: string, attempt: number = 0): Promise<string> => {
  return getGeminiApiKey()
    .then((apiKey) => fetchProcessedText(inputText, apiKey))
    .then((processedText) => retryIfNeeded(inputText, processedText, attempt))
    .then((processedText) => {
      setProcessMessage('', false);
      DOM.outputDiv.textContent = processedText;
      DOM.resultDiv.hidden = false;
      return processedText;
    })
    .catch((error) => {
      setProcessMessage(`Could not determine accents. ${error.message}`, true);
      return Promise.reject(error);
    });
};

DOM.processButton.addEventListener('click', () => {
  const input = DOM.inputText.value.trim();
  if (!input) {
    setProcessMessage('Please enter some text.', true);
    return;
  }
  setProcessMessage('Processing...', false);
  DOM.outputDiv.textContent = '';
  DOM.resultDiv.hidden = true;
  processInput(input).catch(() => { });
});

DOM.copyButton.addEventListener('click', () => {
  const textToCopy = DOM.outputDiv.textContent ?? "";
  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      const originalText = DOM.copyLabel.textContent;
      DOM.copyLabel.textContent = 'Copied!';
      setTimeout(() => { DOM.copyLabel.textContent = originalText; }, 2000);
    })
    .catch((err) => console.error('Error copying text:', err));
});

DOM.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
