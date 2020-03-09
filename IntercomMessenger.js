/* @flow */
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  FlatList,
  TouchableHighlight,ScrollView, Platform,
  TextInput, KeyboardAvoidingView
} from 'react-native';

import PropTypes from "prop-types";
import * as ImagePicker from 'expo-image-picker';

// Partials
import { Ionicons } from '@expo/vector-icons';

const intercomURL = 'https://api.intercom.io/'

const colors = {
  warmBlue: "#3752d8",
  warmGrey: "#999999",
  pinkishGrey: "#c3c3c3",
  offWhite: "#fff8df",
}

class IntercomMessenger extends React.PureComponent {

    checkTimeout = null
    state = {
      intercomAccessToken: this.props.intercomAccessToken,
      user_id: this.props.user_id || null,
      user_email: this.props.user_email || null,
      user_name: this.props.user_name || null,
      message: null,
      conversation: null,
      sentMessage: null,
      messages: [],
      loading: true,
    }

    headers = {}

    constructor(props) {
      super(props);
      this.headers = {
        'Authorization':  'Bearer ' + this.props.intercomAccessToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
      }
    }

    componentDidMount = () => {
      this.setActiveConversation()

      this.checkTimeout = setInterval(() => {
        if (this.state.conversation) {
          console.log("Let's check for updates")
          this.getSingleConversation(this.state.conversation.id).then( (conversation) => {
            this.setState({
              conversation: conversation,
              loading: false
            })
          })
        }
      }, 5000);
    }

    componentDidUpdate = (prevProps) => {
      this.setActiveConversation()
      this.checkTimeout = setInterval(() => {
        if (this.state.conversation) {
          console.log("Let's check for updates")
          this.getSingleConversation(this.state.conversation.id).then( (conversation) => {
            this.setState({
              conversation: conversation,
              loading: false
            })
          })
        }
      }, 5000);
    }

    componentWillUnmount = () => {
      if (this.checkTimeout)
        clearInterval(this.checkTimeout)
    }

    setActiveConversation = () => {
      this.setState({ loading: true })
      this.getConversations(this.state.user_id, this.state.user_email)
      .then( (responseJson) => {
        console.log(responseJson)
        if (responseJson.errors) {
          this.setState({ loading: false })
          console.warn(responseJson.errors)
        } else {
          this.getActiveConversation(responseJson).then( (conversation) => {
            // console.log(conversation)
            this.setState({
              conversation: conversation,
              loading: false
            }, () => {
              this.setAdmin()
            })
          }, (rejection) => {
            this.setState({ loading: false })
          })
        }
      })
    }

    sendMessage = () => {
        let body = {
          "from": {
            "type": "user",
            "user_id": this.state.user_id,
            "email": this.state.user_email,
            "name": this.state.user_name,
          },
          "body": this.state.message
        }

        let url = intercomURL + 'messages'
        return fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(body)
        })
        .then( (response) => response.json())
        .catch( (err) => {
          console.warn(err)
        })
    }

    replyToConversation = async (id) => {

      let image_url;
      if (this.state.image) {
        this.setState({ loading: true })

        // Upload image to Cloudinary or add your own custom solution here
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${this.props.cloudinaryCloud}/image/upload`
        const cloudinaryApiKey = this.props.cloudinaryApiKey
        const timestamp = Date.now()

        let signature = `timestamp=${timestamp}${cloudinaryApiKey}`
      }

      let body = {
        "body": this.state.message,
        "type": "user",
        "message_type": "comment",
        "user_id": this.state.user_id,
        "attachment_urls": [image_url]
      }

      let url = intercomURL + `conversations/${id}/reply?display_as=plaintext`
      return fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      })
      .then( (response) => response.json())
      .catch( (err) => {
        console.warn(err)
      })

    }

    onSendButtonPress = () => {
      if (this.state.conversation) {
        this.replyToConversation(this.state.conversation.id)
        .then( (conversation) => {
          this.setState({
            conversation: conversation,
            loading: false,
            image: null
          })
          this.refs.textInput.clear()
        })

      } else {
        this.sendMessage()
        .then( (message) => {
          this.setState({ sentMessage: message })
          this.refs.textInput.clear()
        })
        .then( () => {
          this.setActiveConversation()
        })
      }
      this.updateUser()
    }


    selectAttachments = async () => {
      if (this.getPermissionAsync()) {
        let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          allowsEditing: true,
          base64: true,
          aspect: [1,1],
        });

        if (!result.cancelled) {
          let finalImage = await this.resizePhoto(result)
          this.setState({
            image: finalImage
          })
        }

      } else {

      }
    }

    getPermissionAsync = async () => {
      if (Platform.OS === 'ios') {
        return { status } = await Permissions.askAsync(Permissions.CAMERA_ROLL);
      }
    }

    resizePhoto = async (image) => {
      const manipResult = await ImageManipulator.manipulateAsync(
        image.localUri || image.uri,
        [
        { resize: {width: 500, height: 500} }
        ],
        {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );
      return manipResult
    }


    updateUser = () => {
      let url = intercomURL + 'users'

      let now = Math.round((new Date()).getTime() / 1000)

      let body = {
        "user_id": this.state.user_id,
        "update_last_request_at": true,
      }

      fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      })
      .then((response) => response.json())
      .then((responseJson) => console.log(responseJson))
      .catch((err) => console.log(err))
    }

    getConversations = (user_id ,user_email) => {
      let query = `?type=user&user_id=${user_id}&email=${user_email}&display_as=plaintext&open=true`
      let url = intercomURL + 'conversations' + query
      return fetch(url, {
        method: 'GET',
        headers: this.headers
      })
      .then( (response) => {
        if (response.status == 200)
          return response.json()
        else {
          setTimeout(() => {
            return this.getConversations(user_id ,user_email)
          }, 2000);
        }
      })
      .catch( (err) => {
        console.warn(err)
      })
    }

    getSingleConversation = (id) => {
      // Intercom returns shortened conversations in the list, so we need to retrieve it individually to get all messages
      let query = `/${id}?display_as=plaintext`
      let url = intercomURL + 'conversations' + query
      return fetch(url, {
        method: 'GET',
        headers: this.headers
      })
      .then( (response) => response.json())
      .catch( (err) => {
        console.warn(err)
      })
    }

    getActiveConversation = (conversations) => {
      // Return first open conversation or nothing
      for (let conversation of conversations.conversations) {
        if (conversation.state == 'open') {
          return this.getSingleConversation(conversation.id)
        }
      }
      return Promise.reject("No conversation found")
    }

    onMessageChange = ( e ) => {
      this.setState({ message: e.nativeEvent.text })
    }

    _keyExtractor = (item, index) => item.id.toString();

    renderMessage = ({item, separators}) => {
      if (item.author.type !== 'bot'){
        return (
          <View style={[styles.message, item.author.type === 'user' && styles.userMessage]}>
            <Text style={styles.messageText}>
              {item.body}
            </Text>
            {item.attachments.length > 0 &&
              item.attachments.map((image, index) => (
                <Image
                  key={index}
                  style={styles.inlineImage}
                  source={{uri: image.url}} />
              ))
            }
          </View>
        )
      }
      return null
    }

    setAdmin = () => {
      if (this.state.conversation) {
        let admin = this.state.conversation.conversation_parts.conversation_parts.find((e) => {
          return e.author.type === 'admin'
        })
        if (admin){
          this.setState({ chattingWith: i18n.t('intercom.chatting_with', { name: admin.author.name }) })
        }
      }
    }

    constructMessagesArray = (conversation) => {
        try {
          if (conversation){
            let array = []
            array.push(conversation.conversation_message)
            return array.concat(conversation.conversation_parts.conversation_parts)
          }
          return []
        } catch (e) {
          return []
        }
    }

    renderLoader = () => {
      if (this.state.loading) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.warmBlue} />
          </View>
        )
      }
      return null
    }

    close = () => {
      clearInterval(this.checkTimeout)
    }

    render = () => (
        <KeyboardAvoidingView
        onLayout={() => { this.scrollView.scrollToEnd({animated: true}); }}
        style = {{ flex: 1 }}
        enabled={true}>
            <View style={styles.container}>
                <View style={styles.header}>
                  {this.props.headerLook}
                </View>
                {this.state.chattingWith &&
                  <View style={styles.chattingWithContainer}>
                    <Text style={styles.chattingWithText}>{this.state.chattingWith}</Text>
                  </View>
                }
                <View style={styles.messagesContainer}>
                  <FlatList data={this.constructMessagesArray(this.state.conversation)}
                    extraData={this.state}
                    style={{flex: 1}}
                    ref={(c) => { this.scrollView = c; }}
                    onContentSizeChange={(contentWidth, contentHeight) => {
                        this.scrollView.scrollToEnd({animated: true});
                    }}
                    keyExtractor={this._keyExtractor}
                    renderItem={this.renderMessage} />

                  {this.state.image &&
                    <View style={styles.imageContainer}>
                      <Image
                        style={styles.image}
                        source={{uri: this.state.image.uri}}
                      />

                      <TouchableAlternateFeedback
                      keyboardShouldPersistTaps='always'
                     background={TouchableNativeFeedback.Ripple(colors.offWhite, false)} delayPressIn={0}
                      onPress={ () => { this.setState({ image: null }) } }>
                        <View style={styles.removeImageIcon}>
                          <Ionicons name="md-close" color={colors.warmGrey} size={20} />
                        </View>
                      </TouchableAlternateFeedback>
                    </View>
                  }

                  <View style={styles.sendMessageContainer}>
                    <TextInput style={styles.sendMessageInput}
                    multiline={true}
                    ref="textInput"
                    placeholder={this.props.textPlaceholder}
                    onChange={this.onMessageChange}/>
                    {this.state.conversation !== null &&
                      <TouchableHighlight
                      keyboardShouldPersistTaps='always'
                      onPress={ this.selectAttachments }>
                        <View style={styles.sendIconContainer}>
                          <Ionicons name="md-attach" color={colors.warmBlue} size={20} />
                        </View>
                      </TouchableHighlight>
                    }

                    {this.state.message !== null && this.state.message !== '' &&
                    <TouchableHighlight keyboardShouldPersistTaps='always' delayPressIn={0} onPress={ this.onSendButtonPress }>
                      <View style={styles.sendIconContainer}>
                        <Ionicons name="md-send" color={colors.warmBlue} size={20} />
                      </View>
                    </TouchableHighlight>}
                  </View>
                </View>
                {this.props.footerLook}
                {this.renderLoader()}
            </View>
        </KeyboardAvoidingView>
    )

    }


const styles = StyleSheet.create({
  removeImageIcon: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 15
  },
  image: {
    height: 100,
    width: 100
  },
  imageContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "flex-start"

  },
  inlineImage: {
    width: 150,
    height: 150,
    resizeMode: 'cover',
    marginTop: 5
  },
  chattingWithText: {
    fontSize: 12,
    color: colors.warmGrey
  },
  chattingWithContainer: {
    marginVertical: 5,
    justifyContent: "center",
    alignItems: "center"
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.6)"
  },
  header: {
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#e8f0ff",
    marginRight: 15
  },
  message: {
    padding: 15,
    backgroundColor: "#ebebeb",
    borderRadius: 5,
    alignSelf: "flex-start",
    marginVertical: 5,
    marginLeft: 15
  },
  messagesList: {
    flexGrow: 1,
    flex: 1,
    paddingHorizontal: 15
  },
  sendIconContainer: {
    padding: 15,
  },
  sendMessageInput: {
    flexGrow: 1,
    paddingHorizontal: 5,
    paddingVertical: 5
  },
  sendMessageContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderColor: colors.pinkishGrey,

  },
  messagesContainer: {
    flex: 1,
  },
  closeIconContainer: {
    padding: 15,
    alignItems: 'flex-end'
  },
  container: {
    flex: 1,
    // paddingBottom: 15,
    position: 'relative'
  }
})

IntercomMessenger.propTypes = {
  intercomAccessToken: PropTypes.string,
  user_id: PropTypes.string,
  user_email: PropTypes.string,
  user_name: PropTypes.string,
  headerLook: PropTypes.element,
  textPlaceholder: PropTypes.string,
  footerLook: PropTypes.element,
  cloudinaryCloud: PropTypes.string,
  cloudinaryApiKey: PropTypes.string
};

export default IntercomMessenger
