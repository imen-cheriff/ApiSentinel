package com.apisentinel.backend.ai.dto;

import java.util.List;

public record ChatRequest(String message, List<ChatMessage> history) {}