import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';

const DebugConsole = () => {
    if (Platform.OS !== 'web') return null;

    const [logs, setLogs] = useState([]);
    const scrollViewRef = useRef(null);

    useEffect(() => {
        const addLog = (msg, color = '#0f0') => {
            setLogs(prev => [...prev.slice(-50), { id: Date.now() + Math.random(), msg, color }]);
        };

        const _log = console.log;
        const _warn = console.warn;
        const _error = console.error;

        console.log = (...args) => {
            addLog('[LOG] ' + args.join(' '));
            _log.apply(console, args);
        };
        console.warn = (...args) => {
            addLog('[WRN] ' + args.join(' '), 'yellow');
            _warn.apply(console, args);
        };
        console.error = (...args) => {
            addLog('[ERR] ' + args.join(' '), 'red');
            _error.apply(console, args);
        };

        const handleError = (event) => {
            addLog('CRASH: ' + event.message, 'red');
        };

        const handleRejection = (event) => {
            addLog('REJECT: ' + (event.reason ? event.reason.toString() : 'Unknown'), 'orange');
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        addLog('Debug Console Active');

        return () => {
            console.log = _log;
            console.warn = _warn;
            console.error = _error;
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    if (logs.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            <ScrollView
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                style={styles.scroll}
            >
                {logs.map(log => (
                    <Text key={log.id} style={[styles.text, { color: log.color }]}>
                        {log.msg}
                    </Text>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 250,
        height: 150,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderWidth: 1,
        borderColor: '#0f0',
        zIndex: 99999,
    },
    scroll: {
        padding: 5,
    },
    text: {
        fontSize: 9,
        fontFamily: 'monospace',
        marginBottom: 2,
    }
});

export default DebugConsole;
