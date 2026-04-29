/**
 * AI Configuration - Prompts and settings
 */

export const SYSTEM_PROMPTS = {
  default: `You are an AI coding assistant. Help developers write better code, explain complex concepts, and solve programming problems efficiently.`,
  
  codeReview: `You are an expert code reviewer. Analyze the code for:
- Code quality and best practices
- Potential bugs and security issues
- Performance optimizations
- Readability and maintainability
- Adherence to style guides

Provide constructive feedback with specific suggestions.`,
  
  refactoring: `You are an expert code refactorer. Improve code quality while maintaining functionality.
Focus on:
- Clean architecture
- Design patterns
- Performance improvements
- Readability
- Testability

Always explain your changes.`,
  
  explanation: `You are an expert educator. Explain code concepts clearly and concisely.
Adapt your explanation to the specified audience level.
Use examples when helpful.
Break down complex logic step by step.`,
  
  debugging: `You are an expert debugger. Help identify and fix issues in code.
Ask clarifying questions when needed.
Provide test cases to verify fixes.`,
  
  generation: `You are an expert code generator. Write clean, efficient, and well-documented code.
Follow best practices for the language.
Include error handling.
Write tests when appropriate.`
};

export const CODE_PROMPTS = {
  completion: `Complete the following code:
{context}\n
{code}\n
// Complete from here:`,
  
  inlineSuggest: `Suggest the next line(s) of code:
File: {file}
Language: {language}
Context: {context}\n
Current line: {code}`,
  
  explain: `Explain this code:
\n{code}\n\nFocus: {focus}`,
  
  refactor: `Refactor this code:
\n{code}\n\nGoals: {goals}\n\nProvide: refactored code + explanation`,
  
  test: `Write tests for this code:
\n{code}\n\nRequirements: {requirements}`,
  
  fix: `Fix the bug in this code:
\n{code}\n\nError: {error}\n\nExpected: {expected}`
};

export const PRIVACY_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit cards
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP addresses
  /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g, // CIDR notation
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, // UUIDs
  /\b(?:sk|pk|ghp)_[A-Za-z0-9]{20,}\b/g, // API keys
  /\bghs_[A-Za-z0-9]{36}\b/g, // GitHub tokens
];

export const MODEL_PRICING = {
  claude: {
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
  },
  gpt: {
    'gpt-4o-2026-04-29': { input: 0.0025, output: 0.010 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
  }
};

export default {
  SYSTEM_PROMPTS,
  CODE_PROMPTS,
  PRIVACY_PATTERNS,
  MODEL_PRICING
};