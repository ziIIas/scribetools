// ==UserScript==
// @name         Genius ScribeTools
// @namespace    http://tampermonkey.net/
// @version      4.13
// @description  Helpful tools for editing lyrics on Genius
// @author       zilla
// @match        https://genius.com/*
// @match        https://*.genius.com/*
// @updateURL    https://github.com/ziIIas/scribetools/raw/refs/heads/main/scribetools.user.js
// @downloadURL  https://github.com/ziIIas/scribetools/raw/refs/heads/main/scribetools.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let emDashEnabled = false;
    let toggleButton = null;
    let autoFixButton = null;
    let settingsPopup = null;
    let settingsBackdrop = null;
    let isInitialized = false;
    let formatPopup = null;
    let currentSelection = null;
    let popupTimeout = null;

    // Auto-save variables
    let autoSaveInterval = null;
    let lastSavedContent = '';
    let isEditing = false;
    let hasShownRestorePrompt = false; // Only show restore prompt once per page load

    // Auto fix settings - default all enabled
    let autoFixSettings = {
        contractions: true,
        capitalizeI: true,
        wordFixes: true,
        apostrophes: true,
        parenthesesFormatting: true,
        bracketHighlighting: true,
        emDashFixes: true,
        capitalizeParentheses: true,
        multipleSpaces: true,
        numberToText: 'ask', // Options: 'off', 'ask', 'on' - default to 'ask' for user control
        customRegex: true,
        customRegexRules: [], // Array of {find: string, replace: string, description: string, flags: string, enabled: boolean}
        emDashEnabled: false, // Save em dash toggle state
        emDashMode: '3', // Options: '2' for --, '3' for --- (default is 3)
        dashType: 'em', // Options: 'em' for em dash (—), 'en' for en dash (–), 'off' for disabled
        dashTrigger: '3', // Options: 'off' for disabled, '2' for --, '3' for --- (moved from emDashMode for dash button settings)
        // New rule groups structure
        ruleGroups: [], // Array of {id: string, title: string, description: string, author: string, version: string, rules: array}
        ungroupedRules: [] // Rules not assigned to any group
    };



    // ===========================================
    // UI UTILITY FUNCTIONS
    // ===========================================
    
