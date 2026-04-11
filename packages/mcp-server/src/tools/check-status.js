/**
 * @module @kickstart/mcp-server/tools/check-status
 *
 * Tool handler: Check deployment status for an active session.
 */
import { createA2UIResource } from "../a2ui.js";
/**
 * Check the deployment status for a session.
 *
 * Phase 1 stub — returns a placeholder progress component.
 * Future: poll Azure Resource Manager for actual deployment status.
 */
export async function handleCheckStatus(sessions, sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
        return {
            content: [{ type: "text", text: `❌ Session \`${sessionId}\` not found.` }],
        };
    }
    // Phase 1 stub — no actual deployment tracking yet
    const progress = {
        type: "DeploymentProgress",
        id: "deployment-status",
        steps: [
            { id: "acr-build", label: "Build container image", status: "pending" },
            { id: "aks-deploy", label: "Deploy to AKS cluster", status: "pending" },
            { id: "ingress-setup", label: "Configure ingress", status: "pending" },
            { id: "dns-config", label: "Set up DNS", status: "pending" },
        ],
        overallStatus: "pending",
    };
    const a2uiResource = createA2UIResource(progress, `a2ui://kickstart/session/${sessionId}/deployment-status`);
    const content = [
        { type: "text", text: `📊 **Deployment status** for session \`${sessionId}\`:\n\nNo deployment has been initiated yet. Use \`generate-manifests\` first, then deploy.` },
    ];
    if (a2uiResource)
        content.push(a2uiResource);
    return { content };
}
//# sourceMappingURL=check-status.js.map