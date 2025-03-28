import React, { useState, useEffect, useCallback, useRef } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/closetag';
import ACTIONS from '../Actions';

const Editor = ({ socketRef, roomId, onCodeChange }) => {
    const editorRef = useRef(null);
    const [output, setOutput] = useState('');
    const outputRef = useRef('');

    useEffect(() => {
        if (!socketRef.current) return;

        async function init() {
            editorRef.current = CodeMirror.fromTextArea(
                document.getElementById('realtimeEditor'),
                {
                    mode: { name: 'javascript', json: true },
                    theme: 'material',
                    autoCloseTags: true,
                    autoCloseBrackets: true,
                    lineNumbers: true,
                    lineWrapping: true,
                }
            );

            // Request initial code when joining
            socketRef.current.emit(ACTIONS.SYNC_CODE, { roomId });

            editorRef.current.on('change', (instance, changes) => {
                const { origin } = changes;
                const code = instance.getValue();
                onCodeChange(code);
                
                if (origin !== 'setValue') {
                    socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                        roomId,
                        code,
                    });
                }
            });
        }
        init();

        return () => {
            if (editorRef.current) {
                editorRef.current.toTextArea();
            }
        };
    }, [socketRef.current, roomId]);

    // Listen for remote changes
    useEffect(() => {
        if (!socketRef.current) return;

        const handleCodeChange = ({ code }) => {
            if (code !== null && editorRef.current) {
                editorRef.current.setValue(code);
            }
        };

        socketRef.current.on(ACTIONS.CODE_CHANGE, handleCodeChange);
        socketRef.current.on(ACTIONS.SYNC_CODE, handleCodeChange);

        return () => {
            socketRef.current.off(ACTIONS.CODE_CHANGE);
            socketRef.current.off(ACTIONS.SYNC_CODE);
        };
    }, [socketRef.current]);

    const handleRunCode = useCallback(() => {
        const code = editorRef.current.getValue();
        let capturedOutput = '';
        const originalLog = console.log;
        
        console.log = (...args) => {
            capturedOutput += args.join(' ') + '\n';
            originalLog.apply(console, args);
        };

        try {
            eval(code);
        } catch (error) {
            capturedOutput += `Error: ${error.message}\n`;
        } finally {
            console.log = originalLog;
        }

        setOutput(capturedOutput);
        outputRef.current = capturedOutput;

        socketRef.current.emit(ACTIONS.OUTPUT_CHANGE, {
            roomId,
            output: capturedOutput,
        });
    }, [roomId]);

    useEffect(() => {
        if (!socketRef.current) return;

        socketRef.current.on(ACTIONS.OUTPUT_CHANGE, ({ output }) => {
            setOutput(output);
            outputRef.current = output;
        });

        return () => {
            socketRef.current?.off(ACTIONS.OUTPUT_CHANGE);
        };
    }, []);

    return (
        <div className="editor-container">
            <textarea id="realtimeEditor"></textarea>
            <button className="run-button" onClick={handleRunCode}>
                Run Code
            </button>
            <div className="output-container" style={{ backgroundColor: 'white', color: '#1c1e29' }}>
                <h3 style={{ color: '#1c1e29' }}>Output:</h3>
                <pre className="output-content" style={{ backgroundColor: 'white', color: '#1c1e29' }}>
                    {output || 'No output yet. Run your code to see results.'}
                </pre>
            </div>
        </div>
    );
};

export default Editor;