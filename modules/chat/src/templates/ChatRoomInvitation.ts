export const ChatRoomInvitation = {
  name: 'ChatRoomInvitation',
  subject: 'Chat room invitation',
  body: 'User {{userName}} invited you to join the room {{roomName}}<br/> Click <a href="{{acceptLink}}">here</a> to accept the invitation<br/>' +
      'Click <a href="{{declineLink}}">here</a> to decline the invitation<br/>',
  variables: ['acceptLink','declineLink','userName','roomName'],
};
