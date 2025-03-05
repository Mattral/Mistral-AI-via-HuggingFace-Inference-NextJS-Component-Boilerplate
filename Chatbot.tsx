"use client";
import { useState, useEffect  } from 'react';
import axios from 'axios';
import { Person } from '@mui/icons-material'; // User Icon
import SupportAgentIcon from '@mui/icons-material/SupportAgent'; // Bot Icon
import MicIcon from '@mui/icons-material/Mic'; // Microphone Icon
import MicOffIcon from '@mui/icons-material/MicOff'; // Microphone Off Icon


// Write your system promot here
/* for example
`
Please reply each and every reply in JSON format, you should make the short facts in each element of JSON.
Do not reply anything apart from JSON`
*/

const systemPromptText = `
You are AI assistant chatbot that answer question in clear and concise manner`;

// How to use model [https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.2]

const model = "mistralai/Mixtral-8x7B-Instruct-v0.1";

//How to get Tokens {https://huggingface.co/docs/hub/en/security-tokens}
const accessToken = process.env.NEXT_PUBLIC_HUGGING_FACE_TOKEN;

const InfoMdChunks: string[] = []; 
// intended read and use chunks from ('/pdf/info.md') file for some context

const loadInfoMd = async () => {
    try {
        // this fetch the content of info.md from the  /pdf/info.md
        
        // Todo: replace with file upload and extract text
        // ToDoL DO not use the code in this function below, add the upload document bottom and extract texts and assign the text to InfoMdChunks
        // 

        const response = await fetch('/pdf/info.md');
        if (!response.ok) {
            throw new Error('Failed to fetch info.md');
        }

        const mdContent = await response.text();

        // Optionally, split the content into chunks if you want (for example, by paragraphs or lines)
        const chunks = mdContent.split('\n\n'); // Splits by empty line, you can customize this
        InfoMdChunks.push(...chunks); // Push content into InfoMdChunks array

        console.log('InfoMdChunks:', InfoMdChunks); // To see the fetched and chunked data
    } catch (error) {
        console.error('Error loading info.md:', error);
    }
};

const formatPromptMixtral = (message: string, history: [string, string][], infoMdChunks: string[]) => {
    let prompt = "<s>";

    const maxHistoryLength = 1;
    const recentHistory = history.slice(-maxHistoryLength);

    const allChunks = infoMdChunks.join("\n\n");
    prompt += `${allChunks}\n\n`;
    prompt += `${systemPromptText}\n\n`;

    if (recentHistory.length) {
        recentHistory.forEach(([userPrompt, botResponse]) => {
            prompt += `[INST] ${userPrompt} [/INST] ${botResponse}</s> `;
        });
    }

    prompt += `[INST] ${message} [/INST]`;

    return prompt;
};

const extractResponse = (generatedText: string): string => {
    const lastInstIndex = generatedText.lastIndexOf('[\/INST]');
    if (lastInstIndex !== -1) {
        return generatedText.slice(lastInstIndex + '[\/INST]'.length).trim();
    }
    return '';
};

const chatInf = async (
    message: string,
    history: [string, string][],
    seed: number,
    temp: number,
    tokens: number,
    topP: number,
    repPenalty: number
) => {
    const generateParams = {
        temperature: temp,
        max_new_tokens: tokens,
        top_p: topP,
        repetition_penalty: repPenalty,
        do_sample: true,
        seed: seed,
    };

    const formattedPrompt = formatPromptMixtral(message, history, InfoMdChunks);

    try {
        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${model}`,
            { inputs: formattedPrompt },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                params: generateParams,
            }
        );

        const generatedText = response.data[0]?.generated_text || '';
        const responseText = extractResponse(generatedText);

        if (!responseText) return [history, "No response from model."];

        history.push([message, responseText]);
        return [history, responseText];
    } catch (error) {
        console.error("API Error:", error);
        return [history, "An error occurred during processing. Please try again."];
    }
};

const Chatbot = () => {
    const [history, setHistory] = useState<[string, string][]>([]);
    const [userInput, setUserInput] = useState<string>('');
    const [botResponse, setBotResponse] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        setLoading(true);

        const seed = Math.floor(Math.random() * 1111111111111111);
        const temp = 0.4;
        const tokens = 5000;
        const topP = 0.9;
        const repPenalty = 1.0;

        const [newHistory, response] = await chatInf(
            userInput,
            history,
            seed,
            temp,
            tokens,
            topP,
            repPenalty
        );

        if (Array.isArray(newHistory) && typeof response === 'string') {
            setHistory(newHistory);
            setBotResponse(response);

            // Convert the bot response to speech
            speakText(response);
        }

        setUserInput('');
        setLoading(false);
    };

    const speakText = (text: string) => {
        const speech = new SpeechSynthesisUtterance(text);
    
        // Set the language to English (you can adjust this if you want a different language)
        speech.lang = 'en-US';
    
        // Get all available voices
        const voices = window.speechSynthesis.getVoices();
    
        // Find the first female voice available
        const femaleVoice = voices.find(voice => voice.name.toLowerCase().includes('female')) || voices[0];
    
        // Set the selected voice
        speech.voice = femaleVoice;
    
        // Adjust pitch and rate (optional, you can modify these values)
        speech.pitch = 1;  // 0 to 2 range, 1 is the default
        speech.rate = 1;   // 0.1 to 10 range, 1 is the default
    
        // Speak the text
        window.speechSynthesis.speak(speech);
    };


    // Microphone functionality
    const startListening = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.lang = 'en-US';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setUserInput(transcript);
                setIsListening(false);
            };

            recognition.onerror = () => {
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.start();
        } else {
            alert("Speech Recognition is not supported in your browser.");
        }
    };

    const stopListening = () => {
        setIsListening(false);
    };
    

    useEffect(() => {
        loadInfoMd(); // Load the file when the component mounts
    }, []);

    return (
        <div style={{
            fontFamily: 'Roboto, sans-serif',
            padding: '30px',
            maxWidth: '900px',
            margin: '0 auto',
            backgroundColor: '#ffffff', // White background for cleanliness
            borderRadius: '20px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            <h1 style={{
                fontSize: '36px',
                color: '#333',
                marginBottom: '20px',
                textAlign: 'center',
                fontWeight: 700,
                textTransform: 'uppercase',
            }}>AI Therapist</h1>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '20px',
                borderRadius: '12px',
                backgroundColor: '#f7f7f7', // Light gray background for messages
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                marginBottom: '100px', // Increased space for the fixed form
            }}>
                {history.map(([userPrompt, botResponse], index) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '12px',
                        }}>

                            <div style={{
                                backgroundColor: '#007BFF', // Matching blue for the user message
                                color: '#fff',
                                padding: '15px 20px',
                                borderRadius: '25px',
                                maxWidth: '75%',
                                fontSize: '16px',
                                wordWrap: 'break-word',
                                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                            }}>
                                <strong>You:</strong> {userPrompt}
                            </div>
                            <div style={{
                                backgroundColor: '#007BFF', // Deep blue for user icon
                                color: '#fff',
                                padding: '16px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '50px',
                                height: '50px',
                                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                            }}>
                                <Person style={{ fontSize: '24px' }} />
                            </div>

                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}>
                            <div style={{
                                backgroundColor: '#4C9AFF', // Soft blue for the bot icon
                                color: '#fff',
                                padding: '16px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '50px',
                                height: '50px',
                                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                            }}>
                                <SupportAgentIcon style={{ fontSize: '24px' }} />
                            </div>
                            <div style={{
                                backgroundColor: '#f1f3f6', // Light gray for bot message
                                color: '#333',
                                padding: '15px 20px',
                                borderRadius: '25px',
                                maxWidth: '75%',
                                fontSize: '16px',
                                wordWrap: 'break-word',
                                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                            }}>
                                <strong>AI:</strong> {botResponse}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit} style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                right: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',

            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Type your message here"
                        style={{
                            padding: '15px 20px',
                            fontSize: '16px',
                            borderRadius: '25px',
                            border: '1px solid #ccc',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                            backgroundColor: '#fff',
                            transition: 'all 0.3s ease',
                            width: '90%',
                            paddingRight: '60px', // To avoid overlap with the mic button

                        }}
                    />
                    <button
                        type="button"
                        onClick={isListening ? stopListening : startListening}
                        style={{
                            backgroundColor: '#007BFF',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            padding: '12px',
                            cursor: 'pointer',
                            position: 'absolute', // Make mic button float to the right
                            right: '20px', // Align the mic button to the right
                        }}
                    >
                        {isListening ? <MicOffIcon style={{ fontSize: '24px' }} /> : <MicIcon style={{ fontSize: '24px' }} />}
                    </button>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: '15px 20px',
                        fontSize: '16px',
                        borderRadius: '25px',
                        backgroundColor: '#4C9AFF', // Elegant deep blue for the button
                        color: '#fff',
                        border: 'none',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.3s, transform 0.3s',
                        transform: loading ? 'none' : 'scale(1.05)',
                        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.1)',
                    }}
                >
                    {loading ? 'Loading...' : 'Send'}
                </button>
            </form>
        </div>
    );
};

export default Chatbot;
