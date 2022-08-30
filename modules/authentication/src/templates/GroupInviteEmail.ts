export const GroupInviteEmail = {
  name: 'GroupInviteEmail',
  subject: "You're invited to join a group",
  body: `Click <a href='{{acceptLink}}'>here</a> to accept the invitation
   </br>
  Click <a href='{{rejectLink}}'>here</a> to reject the invitation`,
  variables: ['acceptLink', 'rejectLink'],
};
