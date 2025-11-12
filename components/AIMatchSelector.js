import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, TextInput, Alert } from 'react-native';

export default function AIMatchSelector({ aiResult, onMatchSelected, onCancel }) {
  const { aiIdentification, matches, photoUrl } = aiResult;
  const [editedName, setEditedName] = useState(aiIdentification.name);
  const [isEditing, setIsEditing] = useState(false);

  const handleSelectMatch = (match) => {
    Alert.alert(
      'Confirm Selection',
      `Use "${match.product_name}"${match.brands ? ` by ${match.brands}` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            onMatchSelected({
              ...match,
              userPhotoUrl: photoUrl,
              aiIdentifiedName: editedName,
              aiConfidence: aiIdentification.confidence
            });
          }
        }
      ]
    );
  };

  const handleManualEntry = () => {
    // If user wants to enter details manually instead of selecting a match
    onMatchSelected({
      isManualEntry: true,
      product_name: editedName,
      userPhotoUrl: photoUrl,
      aiIdentifiedName: editedName,
      aiConfidence: aiIdentification.confidence
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Match</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Photo */}
        {photoUrl && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
          </View>
        )}

        {/* AI Identification */}
        <View style={styles.aiSection}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiTitle}>🤖 AI Identified As:</Text>
            <Text style={styles.confidenceText}>
              {Math.round(aiIdentification.confidence * 100)}% confident
            </Text>
          </View>

          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Enter product name"
                autoFocus
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.saveButtonText}>✓ Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={styles.nameContainer}
            >
              <Text style={styles.aiName}>{editedName}</Text>
              <Text style={styles.editHint}>Tap to edit</Text>
            </TouchableOpacity>
          )}

          {aiIdentification.reasoning && (
            <Text style={styles.reasoning}>{aiIdentification.reasoning}</Text>
          )}
        </View>

        {/* Matches */}
        <Text style={styles.sectionTitle}>
          {matches.length > 0 ? `${matches.length} matches from Open Food Facts:` : 'No matches found'}
        </Text>

        {matches.length > 0 ? (
          matches.map((match, index) => (
            <TouchableOpacity
              key={index}
              style={styles.matchCard}
              onPress={() => handleSelectMatch(match)}
              activeOpacity={0.7}
            >
              <View style={styles.matchContent}>
                {match.image_thumb_url && (
                  <Image
                    source={{ uri: match.image_thumb_url }}
                    style={styles.matchImage}
                    resizeMode="contain"
                  />
                )}
                <View style={styles.matchInfo}>
                  <Text style={styles.matchName}>{match.product_name}</Text>
                  {match.brands && (
                    <Text style={styles.matchBrand}>{match.brands}</Text>
                  )}
                  {match.quantity && (
                    <Text style={styles.matchQuantity}>{match.quantity}</Text>
                  )}
                  <View style={styles.matchTags}>
                    {match.nutriscore_grade && (
                      <View style={[styles.tag, styles.nutriscoreTag]}>
                        <Text style={styles.tagText}>Nutri-Score: {match.nutriscore_grade.toUpperCase()}</Text>
                      </View>
                    )}
                    {match.vegan === 1 && (
                      <View style={[styles.tag, styles.veganTag]}>
                        <Text style={styles.tagText}>🌱 Vegan</Text>
                      </View>
                    )}
                    {match.vegetarian === 1 && (
                      <View style={[styles.tag, styles.vegetarianTag]}>
                        <Text style={styles.tagText}>🥗 Vegetarian</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.matchScore}>
                <Text style={styles.matchScoreText}>Match: {match.match_score || 0}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.noMatchesContainer}>
            <Text style={styles.noMatchesText}>No matches found in Open Food Facts</Text>
            <TouchableOpacity
              style={styles.manualEntryButton}
              onPress={handleManualEntry}
            >
              <Text style={styles.manualEntryButtonText}>✏️ Enter Manually</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    padding: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  photoContainer: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    padding: 20,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  aiSection: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confidenceText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  nameContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  aiName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  editHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  editInput: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 18,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  reasoning: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    padding: 20,
    paddingBottom: 10,
  },
  matchCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchContent: {
    flexDirection: 'row',
    padding: 15,
  },
  matchImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  matchInfo: {
    flex: 1,
    marginLeft: 15,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  matchBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  matchQuantity: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  matchTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 5,
    marginBottom: 5,
  },
  nutriscoreTag: {
    backgroundColor: '#e8f5e9',
  },
  veganTag: {
    backgroundColor: '#e1f5fe',
  },
  vegetarianTag: {
    backgroundColor: '#fff3e0',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  matchScore: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignItems: 'flex-end',
  },
  matchScoreText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  noMatchesContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noMatchesText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
  },
  manualEntryButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
  manualEntryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
