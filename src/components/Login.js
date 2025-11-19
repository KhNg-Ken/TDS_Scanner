import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';

// Small monochrome eye icon constructed from Views so it stays theme-neutral
function EyeIcon({ color = '#ccc', size = 18, visible = false }) {
    const outerWidth = size * 1.6;
    const outerHeight = size;
    const pupilSize = Math.round(size * 0.35);

    return (
        <View
            style={{
                width: outerWidth,
                height: outerHeight,
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            {/* outer eye shape (oval) */}
            <View
                style={{
                    position: 'absolute',
                    width: outerWidth,
                    height: outerHeight / 1.2,
                    borderWidth: 2,
                    borderColor: color,
                    borderRadius: outerHeight,
                }}
            />

            {/* pupil when password is hidden */}
            {!visible ? (
                <View
                    style={{
                        width: pupilSize,
                        height: pupilSize,
                        borderRadius: pupilSize / 2,
                        backgroundColor: color,
                    }}
                />
            ) : null}

            {/* slash when password is visible */}
            {visible ? (
                <View
                    style={{
                        position: 'absolute',
                        width: outerWidth,
                        height: 2,
                        backgroundColor: color,
                        transform: [{ rotate: '-25deg' }],
                    }}
                />
            ) : null}
        </View>
    );
}

const mockDatabase = [
    { email: 'user1@example.com', password: 'password123' },
    { email: 'user2@example.com', password: 'password456' },
];

export default function Auth({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = () => {
        const user = mockDatabase.find(
            (user) => user.email === email && user.password === password,
        );

        if (user) {
            setMessage('Login successful!');
            if (typeof onLogin === 'function') onLogin();
        } else {
            setMessage('Invalid email or password.');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.brand}>TD South</Text>
                <Text style={styles.title}>Welcome Back</Text>
            </View>

            <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#bbb"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <View style={styles.passwordWrapper}>
                <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Password"
                    placeholderTextColor="#bbb"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                />

                <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((s) => !s)}
                    activeOpacity={0.8}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                    <EyeIcon
                        color={(styles.eyeIconColor && styles.eyeIconColor.color) || '#ccc'}
                        size={18}
                        visible={showPassword}
                    />
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin} activeOpacity={0.85}>
                <Text style={styles.loginButtonText}>LOG IN</Text>
            </TouchableOpacity>

            {message ? (
                <Text
                    style={[
                        styles.message,
                        message.includes('successful') ? styles.success : styles.error,
                    ]}
                >
                    {message}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#000',
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    brand: {
        color: '#E10600',
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: 2,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 6,
    },
    input: {
        width: '100%',
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E10600',
        borderRadius: 6,
        backgroundColor: '#111',
        color: '#fff',
    },
    inputRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    inputFlex: {
        flex: 1,
        marginBottom: 0,
    },
    passwordWrapper: {
        width: '100%',
        marginBottom: 14,
        position: 'relative',
    },
    passwordInput: {
        paddingRight: 48, // leave space for the eye icon
        marginBottom: 0,
    },
    eyeButton: {
        position: 'absolute',
        right: 10,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    eyeIcon: {
        color: '#E10600',
        fontWeight: '700',
        fontSize: 16,
    },
    // color token for programmatic icons (EyeIcon uses this key)
    eyeIconColor: {
        color: '#ccc',
    },
    loginButton: {
        width: '100%',
        backgroundColor: '#E10600',
        paddingVertical: 14,
        borderRadius: 6,
        alignItems: 'center',
        marginTop: 6,
    },
    loginButtonText: {
        color: '#000',
        fontWeight: '800',
        fontSize: 16,
    },
    message: {
        marginTop: 16,
        fontSize: 15,
    },
    success: {
        color: '#7ed957',
    },
    error: {
        color: '#ff6b6b',
    },
});
