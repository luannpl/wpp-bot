export default class SessionController {
  constructor(sessionService) {
    this.sessionService = sessionService;
  }

  createSession = async (req, res) => {
    const { sessionId, sourceGroupPrefix, targetGroupPrefix } = req.body;

    const session = await this.sessionService.createSession(
      sessionId,
      sourceGroupPrefix,
      targetGroupPrefix
    );

    return res.json(session);
  };

  stopSession = async (req, res) => {
    const { sessionId } = req.params;
    const session = await this.sessionService.stopSession(sessionId);
    return res.json(session);
  };

  listSessions = async (req, res) => {
    const sessions = await this.sessionService.listSessions();
    return res.json(sessions);
  };

  getQRCode = async (req, res) => {
    const { sessionId } = req.params;
    const qrCode = await this.sessionService.getQRCode(sessionId);
    return res.json(qrCode);
  };

  updateSessionConfig = async (req, res) => {
    const { sessionId } = req.params;
    const { sourceGroup, targetGroup } = req.body;

    const session = await this.sessionService.updateSessionConfig(
      sessionId,
      sourceGroup,
      targetGroup
    );

    return res.json(session);
  };
}