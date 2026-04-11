export interface ConversationRequest {
    sessionId?: string;
    message: string;
    stream?: boolean;
}
export interface ConversationResponse {
    sessionId: string;
    phase: string;
    message: string;
    a2ui?: unknown[];
    model?: string;
}
export declare function healthCheck(): Promise<boolean>;
export declare function converse(req: ConversationRequest): Promise<ConversationResponse>;
//# sourceMappingURL=api-client.d.ts.map