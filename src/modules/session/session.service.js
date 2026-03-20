export default class SessionService {
    constructor(sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    async createSession(sessionId, sourceGroupPrefix, targetGroupPrefix) {
        const session = await this.sessionRepository.createSession(sessionId, sourceGroupPrefix, targetGroupPrefix);
        return session;
    }

    async stopSession(sessionId) {
        const session = await this.sessionRepository.stopSession(sessionId);
        return session;
    }

    async listSessions() {
        return this.sessionRepository.listSessions();
    }

    async getQRCode(sessionId) {
        return this.sessionRepository.getQRCode(sessionId);
    }

    async updateSessionConfig(sessionId, sourceGroup, targetGroup) {
        return this.sessionRepository.updateSessionConfig(sessionId, sourceGroup, targetGroup);
    }
}