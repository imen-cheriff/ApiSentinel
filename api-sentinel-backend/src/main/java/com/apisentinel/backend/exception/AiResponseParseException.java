package com.apisentinel.backend.exception;

public class AiResponseParseException extends RuntimeException {

    public AiResponseParseException(String message, Throwable cause) {
        super(message, cause);
    }
}