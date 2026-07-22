import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId =
      client.handshake.query.userId || client.handshake.headers['x-user-id'];
    if (userId) {
      client.data = { userId };
      void client.join(`user:${userId as string}`);
      this.server.emit('user.status_changed', { userId, status: 'online' });
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      this.server.emit('user.status_changed', { userId, status: 'offline' });
    }
  }

  @SubscribeMessage('joinProject')
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() projectId: string,
  ) {
    void client.join(`project:${projectId}`);
    return { status: 'joined', project: projectId };
  }

  @SubscribeMessage('leaveProject')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() projectId: string,
  ) {
    void client.leave(`project:${projectId}`);
    return { status: 'left', project: projectId };
  }

  // --- Broadcasters ---
  emitIssueUpdated(projectId: string, issue: any) {
    this.server.to(`project:${projectId}`).emit('issue.updated', issue);
    // Also emit globally for ease of integration/test verification
    this.server.emit('issue.updated', issue);
  }

  emitCommentCreated(
    projectId: string,
    payload: {
      issueId: string;
      commentId: string;
      authorId: string;
      bodyPreview: string;
      parentCommentId: string | null;
      hasImages: boolean;
    },
  ) {
    this.server
      .to(`project:${projectId}`)
      .emit('issue.comment_created', payload);
    // Also emit globally
    this.server.emit('issue.comment_created', payload);
  }

  emitTimeBlockSynced(userId: string, projectId: string, payload: any) {
    this.server.to(`project:${projectId}`).emit('timeblock.synced', payload);
    this.server.to(`user:${userId}`).emit('timeblock.synced', payload);
    // Also emit globally
    this.server.emit('timeblock.synced', payload);
  }

  emitTimeBlockOverridden(timeBlockId: string, payload: any) {
    if (payload.projectId) {
      this.server
        .to(`project:${payload.projectId as string}`)
        .emit('timeblock.overridden', { timeBlockId, ...payload });
    }
    this.server.emit('timeblock.overridden', { timeBlockId, ...payload });
  }
}
