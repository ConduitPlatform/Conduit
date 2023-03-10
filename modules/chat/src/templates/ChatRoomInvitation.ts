export const ChatRoomInvitation = {
  name: 'ChatRoomInvitation',
  subject: 'Chat room invitation',
  body:
    'User {{userName}} invited you to join the room {{roomName}}<br/> Click <a href="{{acceptLink}}">here</a> to accept the invitation<br/>' +
    '<p>or use this link: {{acceptLink}} </p><br/>' +
    'Click <a href="{{declineLink}}">here</a> to decline the invitation<br/>' +
    '<p>or use this link: {{declineLink}}</p>',
  variables: ['acceptLink', 'declineLink', 'userName', 'roomName'],
};
